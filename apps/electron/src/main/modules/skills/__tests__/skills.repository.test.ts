import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the database module before importing the repository
const mockDb = {
  get: vi.fn(),
  all: vi.fn(),
  execute: vi.fn(),
  run: vi.fn(),
};

vi.mock("@/main/infrastructure/database/sqlite-manager", () => ({
  getSqliteManager: () => mockDb,
}));

// Now we can import the repository
import { SkillRepository } from "../skills.repository";

describe("SkillRepository", () => {
  let repository: SkillRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    SkillRepository.resetInstance();
    repository = SkillRepository.getInstance();
  });

  afterEach(() => {
    SkillRepository.resetInstance();
  });

  describe("getInstance", () => {
    it("should return a singleton instance", () => {
      const instance1 = SkillRepository.getInstance();
      const instance2 = SkillRepository.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should return a new instance after resetInstance", () => {
      const instance1 = SkillRepository.getInstance();
      SkillRepository.resetInstance();
      const instance2 = SkillRepository.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("findByName", () => {
    it("should find skill by name case-insensitively", () => {
      const mockRow = {
        id: "skill-1",
        name: "MySkill",
        project_id: null,
        enabled: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
      };
      mockDb.get.mockReturnValue(mockRow);

      const result = repository.findByName("myskill");

      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining("COLLATE NOCASE"),
        expect.objectContaining({ name: "myskill" }),
      );
      expect(result).not.toBeNull();
      expect(result?.name).toBe("MySkill");
    });

    it("should return null for non-existent skill", () => {
      mockDb.get.mockReturnValue(undefined);

      const result = repository.findByName("nonexistent");

      expect(result).toBeNull();
    });

    it("should return null for empty/whitespace input", () => {
      const result1 = repository.findByName("");
      const result2 = repository.findByName("   ");

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(mockDb.get).not.toHaveBeenCalled();
    });

    it("should trim input before searching", () => {
      mockDb.get.mockReturnValue(null);

      repository.findByName("  skill-name  ");

      expect(mockDb.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ name: "skill-name" }),
      );
    });
  });

  describe("getAll", () => {
    it("should return all skills ordered by name", () => {
      const mockRows = [
        {
          id: "1",
          name: "Alpha",
          project_id: null,
          enabled: 1,
          created_at: 1,
          updated_at: 1,
        },
        {
          id: "2",
          name: "Beta",
          project_id: null,
          enabled: 0,
          created_at: 2,
          updated_at: 2,
        },
      ];
      // BaseRepository first checks if table exists
      mockDb.get.mockReturnValueOnce({ name: "skills" });
      mockDb.all.mockReturnValue(mockRows);

      const result = repository.getAll({ orderBy: "name" });

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining("ORDER BY name"),
        expect.any(Object),
      );
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Alpha");
    });
  });

  describe("add", () => {
    it("should create a new skill with generated ID", () => {
      const now = Date.now();
      const newSkill = {
        name: "test-skill",
        projectId: null,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      };

      mockDb.run.mockReturnValue({ changes: 1 });
      mockDb.get.mockReturnValue({
        id: expect.any(String),
        name: "test-skill",
        project_id: null,
        enabled: 1,
        created_at: now,
        updated_at: now,
      });

      const result = repository.add(newSkill);

      expect(result.name).toBe("test-skill");
      expect(result.id).toBeDefined();
    });
  });

  describe("update", () => {
    it("should update skill fields", () => {
      const existingRow = {
        id: "skill-1",
        name: "OldName",
        project_id: null,
        enabled: 1,
        created_at: 1,
        updated_at: 1,
      };
      mockDb.get.mockReturnValue(existingRow);

      const result = repository.update("skill-1", { name: "NewName" });

      expect(mockDb.execute).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("should return undefined for non-existent skill", () => {
      mockDb.get.mockReturnValue(undefined);

      const result = repository.update("nonexistent", { name: "NewName" });

      expect(result).toBeUndefined();
    });
  });

  describe("delete", () => {
    it("should delete existing skill", () => {
      mockDb.get.mockReturnValue({ id: "skill-1" });
      mockDb.run.mockReturnValue({ changes: 1 });

      const result = repository.delete("skill-1");

      expect(result).toBe(true);
    });

    it("should return true even for non-existent skill", () => {
      // BaseRepository.delete does not check existence; it always returns true
      const result = repository.delete("nonexistent");

      expect(result).toBe(true);
    });
  });
});
