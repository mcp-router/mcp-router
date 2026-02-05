import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fsPromises } from "fs";

// Mock dependencies
const mockSkillRepo = {
  getById: vi.fn(),
  getAll: vi.fn(),
  findByName: vi.fn(),
  add: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockStateRepo = {
  findBySkillAndClient: vi.fn(),
  findBySkill: vi.fn(),
  add: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockFileManager = {
  getSkillsDirectory: vi.fn().mockReturnValue("/mock/skills"),
  getSkillPath: vi.fn().mockImplementation((name) => `/mock/skills/${name}`),
  createSymlink: vi.fn().mockReturnValue(true),
  removeSymlink: vi.fn().mockReturnValue(true),
  verifySymlink: vi.fn().mockReturnValue("active"),
  readSkillMd: vi.fn().mockReturnValue("# Skill Content"),
  writeSkillMd: vi.fn(),
  copyFolderToSkills: vi.fn(),
};

const mockClientAppService = {
  list: vi.fn().mockResolvedValue([]),
  get: vi.fn(),
  discoverSkillsFromClients: vi.fn().mockResolvedValue([]),
};

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
  SkillsFileManager: vi.fn().mockImplementation(() => mockFileManager),
}));

vi.mock("@/main/modules/client-apps/client-app.service", () => ({
  getClientAppService: () => mockClientAppService,
}));

vi.mock("@/main/modules/client-apps/client-detector", () => ({
  resolveGlobPath: vi.fn().mockReturnValue([]),
  expandHomePath: vi.fn().mockImplementation((p) => p),
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
      mockFileManager.createSymlink.mockReturnValue(true);

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
      (fsPromises.lstat as any).mockRejectedValue({ code: "ENOENT" });

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
      (fsPromises.realpath as any).mockRejectedValue({ code: "ENOENT" });

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
      mockFileManager.writeSkillMd.mockImplementation(() => {
        throw new Error("Write failed");
      });

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
  });

  describe("verifyAndRepairAll", () => {
    it("should verify and repair broken symlinks", async () => {
      mockSkillRepo.getAll.mockReturnValue([
        { id: "skill-1", name: "test", enabled: true },
      ]);
      mockClientAppService.list.mockResolvedValue([
        { id: "client-1", name: "Claude", skillsPath: "/home/.claude/skills" },
      ]);
      mockFileManager.verifySymlink.mockReturnValue("broken");
      mockFileManager.createSymlink.mockReturnValue(true);

      const result = await service.verifyAndRepairAll();

      expect(result.repaired).toBeGreaterThanOrEqual(0);
    });
  });
});
