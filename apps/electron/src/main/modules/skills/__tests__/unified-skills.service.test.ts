import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fsPromises } from "fs";

// Use vi.hoisted to ensure mocks are available when vi.mock factories run (hoisted above declarations)
const { mockSkillRepo, mockStateRepo, mockFileManager, mockClientAppService } =
  vi.hoisted(() => ({
    mockSkillRepo: {
      getById: vi.fn(),
      getAll: vi.fn(),
      findByName: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    mockStateRepo: {
      findBySkillAndClient: vi.fn(),
      findBySkill: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteByClient: vi.fn(),
    },
    mockFileManager: {
      ready: vi.fn().mockResolvedValue(undefined),
      getSkillsDirectory: vi.fn().mockReturnValue("/mock/skills"),
      getSkillPath: vi
        .fn()
        .mockImplementation((name: string) => `/mock/skills/${name}`),
      createSymlink: vi.fn().mockResolvedValue(true),
      removeSymlink: vi.fn().mockResolvedValue(true),
      verifySymlink: vi.fn().mockResolvedValue("active"),
      readSkillMd: vi.fn().mockResolvedValue("# Skill Content"),
      readSkillMdAsync: vi.fn().mockResolvedValue("# Skill Content"),
      readSkillMdFromPath: vi.fn().mockResolvedValue("# Skill Content"),
      writeSkillMd: vi.fn().mockResolvedValue(undefined),
      copyFolderToSkills: vi.fn().mockResolvedValue("/mock/skills/copied"),
      createSkillDirectory: vi.fn().mockResolvedValue("/mock/skills/new-skill"),
      deleteSkillDirectory: vi.fn().mockResolvedValue(true),
      renameSkillDirectory: vi.fn().mockResolvedValue("/mock/skills/renamed"),
      skillExists: vi.fn().mockResolvedValue(false),
      extractFolderName: vi.fn().mockImplementation((p: string) => p.split("/").pop()),
      openInFinder: vi.fn(),
    },
    mockClientAppService: {
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn(),
      discoverSkillsFromClients: vi.fn().mockResolvedValue([]),
    },
  }));

vi.mock("../skills.repository", () => ({
  SkillRepository: {
    getInstance: () => mockSkillRepo,
    resetInstance: vi.fn(),
  },
}));

vi.mock("../client-skill-state.repository", () => ({
  ClientSkillStateRepository: {
    getInstance: () => mockStateRepo,
    resetInstance: vi.fn(),
  },
}));

vi.mock("../skills-file-manager", () => ({
  SkillsFileManager: class {
    constructor() {
      Object.assign(this, mockFileManager);
    }
  },
}));

vi.mock("@/main/modules/client-apps/client-app.service", () => ({
  getClientAppService: () => mockClientAppService,
}));

vi.mock("@/main/modules/client-apps/client-detector", () => ({
  resolveGlobPath: vi.fn().mockReturnValue([]),
  expandHomePath: vi.fn().mockImplementation((p: string) => p),
}));

vi.mock("@/main/utils/logger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  safeConsoleLog: vi.fn(),
  safeConsoleError: vi.fn(),
}));

vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
  },
  promises: {
    lstat: vi.fn(),
    realpath: vi.fn(),
    rename: vi.fn(),
  },
}));

// Import after mocks are set up
import { UnifiedSkillsService } from "../unified-skills.service";

describe("UnifiedSkillsService", () => {
  let service: UnifiedSkillsService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFileManager.createSymlink.mockResolvedValue(true);
    mockFileManager.removeSymlink.mockResolvedValue(true);
    mockFileManager.verifySymlink.mockResolvedValue("active");
    mockClientAppService.list.mockResolvedValue([]);
    mockClientAppService.discoverSkillsFromClients.mockResolvedValue([]);
    UnifiedSkillsService.resetInstance();
    service = UnifiedSkillsService.getInstance();
  });

  afterEach(() => {
    UnifiedSkillsService.resetInstance();
  });

  describe("getInstance", () => {
    it("should return a singleton instance", () => {
      const instance1 = UnifiedSkillsService.getInstance();
      const instance2 = UnifiedSkillsService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should return a new instance after resetInstance", () => {
      const instance1 = UnifiedSkillsService.getInstance();
      UnifiedSkillsService.resetInstance();
      const instance2 = UnifiedSkillsService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("listUnified", () => {
    it("should return empty array when no skills exist", async () => {
      mockSkillRepo.getAll.mockReturnValue([]);
      mockClientAppService.discoverSkillsFromClients.mockResolvedValue([]);
      mockClientAppService.list.mockResolvedValue([]);

      const result = await service.listUnified();

      expect(result).toEqual([]);
    });

    it("should return local skills with client states", async () => {
      const mockSkill = {
        id: "skill-1",
        name: "test-skill",
        enabled: true,
        projectId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockSkillRepo.getAll.mockReturnValue([mockSkill]);
      mockClientAppService.list.mockResolvedValue([
        {
          id: "client-1",
          name: "Claude",
          skillsPath: "~/.claude/skills",
        },
      ]);
      mockClientAppService.discoverSkillsFromClients.mockResolvedValue([]);

      const result = await service.listUnified();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("test-skill");
      expect(result[0].source).toBe("local");
      expect(result[0].clientStates).toBeDefined();
    });

    it("should deduplicate discovered skills by name across clients", async () => {
      mockSkillRepo.getAll.mockReturnValue([]);
      mockClientAppService.list.mockResolvedValue([
        { id: "client-1", name: "Claude", skillsPath: null, installed: true },
        { id: "client-2", name: "Cursor", skillsPath: null, installed: true },
      ]);
      mockClientAppService.discoverSkillsFromClients.mockResolvedValue([
        {
          skillName: "shared-skill",
          skillPath: "/path/client-1/shared-skill",
          sourceClientId: "client-1",
          sourceClientName: "Claude",
          hasSkillMd: false,
          isSymlink: false,
        },
        {
          skillName: "shared-skill",
          skillPath: "/path/client-2/shared-skill",
          sourceClientId: "client-2",
          sourceClientName: "Cursor",
          hasSkillMd: false,
          isSymlink: false,
        },
      ]);

      const result = await service.listUnified();

      expect(result).toHaveLength(1);
      expect(result[0].source).toBe("discovered");
      expect(result[0].name).toBe("shared-skill");
    });
  });

  describe("enableForClient", () => {
    it("should enable skill for valid client", async () => {
      mockSkillRepo.getById.mockReturnValue({
        id: "skill-1",
        name: "test-skill",
        enabled: true,
      });
      mockClientAppService.get.mockResolvedValue({
        id: "client-1",
        name: "Claude",
        skillsPath: "/home/user/.claude/skills",
      });
      mockStateRepo.findBySkillAndClient.mockReturnValue(null);
      mockFileManager.createSymlink.mockResolvedValue(true);

      await service.enableForClient("skill-1", "client-1");

      expect(mockFileManager.createSymlink).toHaveBeenCalled();
      expect(mockStateRepo.add).toHaveBeenCalled();
    });

    it("should throw error for non-existent skill", async () => {
      mockSkillRepo.getById.mockReturnValue(null);

      await expect(
        service.enableForClient("nonexistent", "client-1"),
      ).rejects.toThrow("Skill not found");
    });

    it("should throw error for non-existent client", async () => {
      mockSkillRepo.getById.mockReturnValue({ id: "skill-1", name: "test" });
      mockClientAppService.get.mockResolvedValue(null);

      await expect(
        service.enableForClient("skill-1", "nonexistent"),
      ).rejects.toThrow("Client not found");
    });

    it("should throw error if client has no skills path", async () => {
      mockSkillRepo.getById.mockReturnValue({ id: "skill-1", name: "test" });
      mockClientAppService.get.mockResolvedValue({
        id: "client-1",
        name: "Claude",
        skillsPath: null,
      });

      await expect(
        service.enableForClient("skill-1", "client-1"),
      ).rejects.toThrow("no skills path");
    });

    it("should throw error when symlink creation fails", async () => {
      mockSkillRepo.getById.mockReturnValue({
        id: "skill-1",
        name: "test-skill",
        enabled: true,
      });
      mockClientAppService.get.mockResolvedValue({
        id: "client-1",
        name: "Claude",
        skillsPath: "/home/user/.claude/skills",
      });
      mockStateRepo.findBySkillAndClient.mockReturnValue(null);
      mockFileManager.createSymlink.mockResolvedValue(false);

      await expect(
        service.enableForClient("skill-1", "client-1"),
      ).rejects.toThrow("Failed to create one or more skill symlinks");
    });
  });

  describe("disableForClient", () => {
    it("should disable skill and remove symlink", async () => {
      mockSkillRepo.getById.mockReturnValue({
        id: "skill-1",
        name: "test-skill",
      });
      mockClientAppService.get.mockResolvedValue({
        id: "client-1",
        name: "Claude",
        skillsPath: "/home/user/.claude/skills",
      });
      mockStateRepo.findBySkillAndClient.mockReturnValue({
        id: "state-1",
        skillId: "skill-1",
        clientId: "client-1",
        state: "enabled",
      });

      await service.disableForClient("skill-1", "client-1");

      expect(mockFileManager.removeSymlink).toHaveBeenCalled();
      expect(mockStateRepo.update).toHaveBeenCalledWith(
        "state-1",
        expect.objectContaining({ state: "disabled" }),
      );
    });
  });

  describe("adoptSkill", () => {
    it("should throw error if skill already exists locally", async () => {
      mockSkillRepo.findByName.mockReturnValue({
        id: "existing",
        name: "skill-name",
      });

      await expect(
        service.adoptSkill("skill-name", "client-1"),
      ).rejects.toThrow("already exists");
    });

    it("should throw error if discovered skill is not found", async () => {
      mockSkillRepo.findByName.mockReturnValue(null);
      mockClientAppService.discoverSkillsFromClients.mockResolvedValue([]);

      await expect(
        service.adoptSkill("nonexistent", "client-1"),
      ).rejects.toThrow("not found");
    });

    it("should validate skill path exists and is a directory", async () => {
      mockSkillRepo.findByName.mockReturnValue(null);
      mockClientAppService.discoverSkillsFromClients.mockResolvedValue([
        {
          skillName: "test-skill",
          sourceClientId: "client-1",
          skillPath: "/path/to/skill",
          hasSkillMd: true,
          isSymlink: false,
        },
      ]);
      const enoent = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      (fsPromises.lstat as any).mockRejectedValue(enoent);

      await expect(
        service.adoptSkill("test-skill", "client-1"),
      ).rejects.toThrow("no longer exists");
    });

    it("should handle broken symlinks in adoptSkill", async () => {
      mockSkillRepo.findByName.mockReturnValue(null);
      mockClientAppService.discoverSkillsFromClients.mockResolvedValue([
        {
          skillName: "test-skill",
          sourceClientId: "client-1",
          skillPath: "/path/to/skill",
          hasSkillMd: true,
          isSymlink: true,
        },
      ]);
      (fsPromises.lstat as any).mockResolvedValue({
        isSymbolicLink: () => true,
        isDirectory: () => false,
      });
      (fsPromises.realpath as any).mockRejectedValue(
        Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
      );

      await expect(
        service.adoptSkill("test-skill", "client-1"),
      ).rejects.toThrow("broken symlink");
    });
  });

  describe("updateUnified", () => {
    it("should throw error for discovered skills", async () => {
      await expect(
        service.updateUnified("discovered:client-1:skill", { name: "new" }),
      ).rejects.toThrow("discovered skills");
    });

    it("should throw error for non-existent skill", async () => {
      mockSkillRepo.getById.mockReturnValue(null);

      await expect(
        service.updateUnified("nonexistent", { name: "new" }),
      ).rejects.toThrow("Skill not found");
    });

    it("should throw error if new name already exists", async () => {
      mockSkillRepo.getById.mockReturnValue({
        id: "skill-1",
        name: "old-name",
      });
      mockSkillRepo.findByName.mockReturnValue({
        id: "skill-2",
        name: "new-name",
      });

      await expect(
        service.updateUnified("skill-1", { name: "new-name" }),
      ).rejects.toThrow("already exists");
    });

    it("should rename skill folder and update symlinks", async () => {
      mockSkillRepo.getById.mockReturnValue({
        id: "skill-1",
        name: "old-name",
        enabled: true,
        projectId: null,
        createdAt: 1,
        updatedAt: 1,
      });
      mockSkillRepo.findByName.mockReturnValue(null);
      mockClientAppService.list.mockResolvedValue([
        {
          id: "client-1",
          name: "Claude",
          skillsPath: "/home/.claude/skills",
        },
      ]);
      mockStateRepo.findBySkillAndClient.mockReturnValue({
        id: "state-1",
        state: "enabled",
      });
      (fsPromises.rename as any).mockResolvedValue(undefined);

      await service.updateUnified("skill-1", { name: "new-name" });

      expect(fsPromises.rename).toHaveBeenCalled();
      expect(mockSkillRepo.update).toHaveBeenCalled();
    });

    it("should rollback rename if content write fails", async () => {
      mockSkillRepo.getById.mockReturnValue({
        id: "skill-1",
        name: "old-name",
        enabled: true,
        projectId: null,
        createdAt: 1,
        updatedAt: 1,
      });
      mockSkillRepo.findByName.mockReturnValue(null);
      mockClientAppService.list.mockResolvedValue([]);
      (fsPromises.rename as any).mockResolvedValue(undefined);
      mockFileManager.writeSkillMd.mockRejectedValue(
        new Error("Write failed"),
      );

      await expect(
        service.updateUnified("skill-1", {
          name: "new-name",
          content: "content",
        }),
      ).rejects.toThrow("Write failed");

      // Rename should be attempted to rollback
      expect(fsPromises.rename).toHaveBeenCalledTimes(2); // Initial rename + rollback
    });
  });

  describe("syncToAllClients", () => {
    it("should sync skill to all clients", async () => {
      mockSkillRepo.getById.mockReturnValue({
        id: "skill-1",
        name: "test-skill",
      });
      mockClientAppService.list.mockResolvedValue([
        { id: "client-1", name: "Claude", skillsPath: "/path1" },
        { id: "client-2", name: "Cursor", skillsPath: "/path2" },
      ]);

      const result = await service.syncToAllClients("skill-1");

      expect(result.synced).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it("should skip clients without skills path", async () => {
      mockSkillRepo.getById.mockReturnValue({
        id: "skill-1",
        name: "test-skill",
      });
      mockClientAppService.list.mockResolvedValue([
        { id: "client-1", name: "Claude", skillsPath: null },
      ]);

      const result = await service.syncToAllClients("skill-1");

      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].reason).toContain("No skills path");
    });

    it("should report errors when symlink creation fails", async () => {
      mockSkillRepo.getById.mockReturnValue({
        id: "skill-1",
        name: "test-skill",
      });
      mockClientAppService.list.mockResolvedValue([
        { id: "client-1", name: "Claude", skillsPath: "/path1" },
      ]);
      mockStateRepo.findBySkillAndClient.mockReturnValue(null);
      mockFileManager.createSymlink.mockResolvedValue(false);

      const result = await service.syncToAllClients("skill-1");

      expect(result.synced).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain(
        "Failed to create one or more skill symlinks",
      );
    });
  });

  describe("verifyAndRepairAll", () => {
    it("should verify and repair broken symlinks", async () => {
      mockSkillRepo.getAll.mockReturnValue([
        { id: "skill-1", name: "test", enabled: true },
      ]);
      mockClientAppService.list.mockResolvedValue([
        { id: "client-1", name: "Claude", skillsPath: "/home/.claude/skills" },
      ]);
      mockFileManager.verifySymlink.mockResolvedValue("broken");
      mockFileManager.createSymlink.mockResolvedValue(true);

      const result = await service.verifyAndRepairAll();

      expect(result.repaired).toBeGreaterThanOrEqual(0);
    });
  });
});
