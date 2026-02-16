import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

// Mock electron app module
vi.mock("electron", () => ({
  app: {
    getPath: vi.fn().mockReturnValue("/mock/user/data"),
  },
  shell: {
    openPath: vi.fn(),
  },
}));

// Mock fs module - now using promises for async operations
vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    rmSync: vi.fn(),
    renameSync: vi.fn(),
    lstatSync: vi.fn(),
    symlinkSync: vi.fn(),
    readlinkSync: vi.fn(),
    readdirSync: vi.fn(),
    copyFileSync: vi.fn(),
    promises: {
      access: vi.fn(),
      mkdir: vi.fn(),
      writeFile: vi.fn(),
      readFile: vi.fn(),
      unlink: vi.fn(),
      rm: vi.fn(),
      rename: vi.fn(),
      lstat: vi.fn(),
      symlink: vi.fn(),
      readlink: vi.fn(),
      readdir: vi.fn(),
      copyFile: vi.fn(),
    },
  },
}));

// Mock path-security module
vi.mock("@/main/utils/path-security", () => ({
  isPathContained: vi.fn().mockReturnValue(true),
  isPathAllowed: vi.fn().mockReturnValue(true),
  validateSkillName: vi.fn().mockReturnValue({ valid: true }),
  validateSkillSymlinkTarget: vi.fn().mockReturnValue({ valid: true }),
  validateCopyOperation: vi.fn().mockReturnValue({ valid: true }),
}));

import { SkillsFileManager } from "../skills-file-manager";
import {
  isPathContained,
  isPathAllowed,
  validateSkillName,
  validateSkillSymlinkTarget,
} from "@/main/utils/path-security";

const fsPromises = fs.promises;

describe("SkillsFileManager", () => {
  let fileManager: SkillsFileManager;
  const mockSkillsDir = "/mock/user/data/skills";

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: directory doesn't exist (access throws ENOENT), mkdir succeeds
    (fsPromises.access as any).mockRejectedValue(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
    );
    (fsPromises.mkdir as any).mockResolvedValue(undefined);
    (fsPromises.writeFile as any).mockResolvedValue(undefined);
    (fsPromises.readFile as any).mockResolvedValue("");
    (fsPromises.unlink as any).mockResolvedValue(undefined);
    (fsPromises.rm as any).mockResolvedValue(undefined);
    (fsPromises.rename as any).mockResolvedValue(undefined);
    (fsPromises.symlink as any).mockResolvedValue(undefined);
    (fsPromises.readlink as any).mockResolvedValue("");
    (fsPromises.readdir as any).mockResolvedValue([]);
    (fsPromises.copyFile as any).mockResolvedValue(undefined);
    (fsPromises.lstat as any).mockRejectedValue(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
    );

    fileManager = new SkillsFileManager();
  });

  describe("constructor and ready()", () => {
    it("should create skills directory if it does not exist", async () => {
      (fsPromises.access as any).mockRejectedValue(
        Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
      );
      const fm = new SkillsFileManager();
      await fm.ready();

      expect(fsPromises.mkdir).toHaveBeenCalledWith(mockSkillsDir, {
        recursive: true,
      });
    });

    it("should not recreate directory if it exists", async () => {
      vi.clearAllMocks();
      (fsPromises.access as any).mockResolvedValue(undefined);
      const fm = new SkillsFileManager();
      await fm.ready();

      expect(fsPromises.mkdir).not.toHaveBeenCalled();
    });
  });

  describe("getSkillsDirectory", () => {
    it("should return the skills directory path", () => {
      expect(fileManager.getSkillsDirectory()).toBe(mockSkillsDir);
    });
  });

  describe("createSkillDirectory", () => {
    it("should create skill directory with SKILL.md", async () => {
      // access throws ENOENT = path doesn't exist (what we want)
      (fsPromises.access as any).mockRejectedValue(
        Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
      );
      (validateSkillName as any).mockReturnValue({ valid: true });
      (isPathContained as any).mockReturnValue(true);

      const result = await fileManager.createSkillDirectory("my-skill");

      expect(fsPromises.mkdir).toHaveBeenCalledWith(
        path.join(mockSkillsDir, "my-skill"),
        { recursive: true },
      );
      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        path.join(mockSkillsDir, "my-skill", "SKILL.md"),
        expect.stringContaining("# my-skill"),
        "utf-8",
      );
      expect(result).toBe(path.join(mockSkillsDir, "my-skill"));
    });

    it("should throw error for invalid skill name", async () => {
      (validateSkillName as any).mockReturnValue({
        valid: false,
        error: "Invalid name",
      });

      await expect(
        fileManager.createSkillDirectory("../bad"),
      ).rejects.toThrow("Invalid name");
    });

    it("should throw error if directory already exists", async () => {
      (validateSkillName as any).mockReturnValue({ valid: true });
      (isPathContained as any).mockReturnValue(true);
      // access succeeds = path exists
      (fsPromises.access as any).mockResolvedValue(undefined);

      await expect(
        fileManager.createSkillDirectory("existing"),
      ).rejects.toThrow("already exists");
    });

    it("should throw error for path traversal", async () => {
      (validateSkillName as any).mockReturnValue({ valid: true });
      (isPathContained as any).mockReturnValue(false);

      await expect(
        fileManager.createSkillDirectory("skill"),
      ).rejects.toThrow("path traversal");
    });
  });

  describe("createSymlink", () => {
    it("should create symlink for valid paths", async () => {
      (isPathContained as any).mockReturnValue(true);
      (validateSkillSymlinkTarget as any).mockReturnValue({ valid: true });
      // pathExists returns false (access throws), isSymlinkExists returns false (lstat throws)
      (fsPromises.access as any).mockRejectedValue(
        Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
      );
      (fsPromises.lstat as any).mockRejectedValue(
        Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
      );

      const result = await fileManager.createSymlink(
        path.join(mockSkillsDir, "my-skill"),
        path.join("/home/user/.claude/skills", "my-skill"),
      );

      expect(fsPromises.symlink).toHaveBeenCalledWith(
        path.join(mockSkillsDir, "my-skill"),
        path.join("/home/user/.claude/skills", "my-skill"),
        "dir",
      );
      expect(result).toBe(true);
    });

    it("should return false if source is outside skills directory", async () => {
      (isPathContained as any).mockReturnValue(false);

      const result = await fileManager.createSymlink(
        "/other/path",
        "/home/user/.claude/skills/my-skill",
      );

      expect(result).toBe(false);
      expect(fsPromises.symlink).not.toHaveBeenCalled();
    });

    it("should return false if target path is not allowed", async () => {
      (isPathContained as any).mockReturnValue(true);
      (validateSkillSymlinkTarget as any).mockReturnValue({
        valid: false,
        error: "Not allowed",
      });

      const result = await fileManager.createSymlink(
        path.join(mockSkillsDir, "my-skill"),
        "/etc/skills/my-skill",
      );

      expect(result).toBe(false);
    });

    it("should remove existing symlink before creating new one", async () => {
      (isPathContained as any).mockReturnValue(true);
      (validateSkillSymlinkTarget as any).mockReturnValue({ valid: true });
      // pathExists returns true (access succeeds)
      (fsPromises.access as any).mockResolvedValue(undefined);
      (fsPromises.lstat as any).mockResolvedValue({
        isSymbolicLink: () => true,
      });

      await fileManager.createSymlink(
        path.join(mockSkillsDir, "my-skill"),
        "/home/user/.claude/skills/my-skill",
      );

      expect(fsPromises.unlink).toHaveBeenCalled();
      expect(fsPromises.symlink).toHaveBeenCalled();
    });

    it("should not overwrite non-symlink files", async () => {
      (isPathContained as any).mockReturnValue(true);
      (validateSkillSymlinkTarget as any).mockReturnValue({ valid: true });
      // pathExists returns true (access succeeds)
      (fsPromises.access as any).mockResolvedValue(undefined);
      (fsPromises.lstat as any).mockResolvedValue({
        isSymbolicLink: () => false,
      });

      const result = await fileManager.createSymlink(
        path.join(mockSkillsDir, "my-skill"),
        "/home/user/.claude/skills/my-skill",
      );

      expect(result).toBe(false);
      expect(fsPromises.symlink).not.toHaveBeenCalled();
    });
  });

  describe("removeSymlink", () => {
    it("should remove existing symlink", async () => {
      (fsPromises.lstat as any).mockResolvedValue({
        isSymbolicLink: () => true,
      });

      const result = await fileManager.removeSymlink("/path/to/symlink");

      expect(fsPromises.unlink).toHaveBeenCalledWith("/path/to/symlink");
      expect(result).toBe(true);
    });

    it("should return false for non-symlink files", async () => {
      (fsPromises.lstat as any).mockResolvedValue({
        isSymbolicLink: () => false,
      });

      const result = await fileManager.removeSymlink("/path/to/regular-file");

      expect(fsPromises.unlink).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it("should return true for non-existent paths", async () => {
      (fsPromises.lstat as any).mockRejectedValue(
        Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
      );

      const result = await fileManager.removeSymlink("/nonexistent/path");

      expect(result).toBe(true);
    });
  });

  describe("verifySymlink", () => {
    it("should return 'active' for valid symlink", async () => {
      (fsPromises.lstat as any).mockResolvedValue({
        isSymbolicLink: () => true,
      });
      (fsPromises.readlink as any).mockResolvedValue("/target/path");
      (fsPromises.access as any).mockResolvedValue(undefined);

      const result = await fileManager.verifySymlink("/path/to/symlink");

      expect(result).toBe("active");
    });

    it("should return 'broken' for symlink with missing target", async () => {
      (fsPromises.lstat as any).mockResolvedValue({
        isSymbolicLink: () => true,
      });
      (fsPromises.readlink as any).mockResolvedValue("/missing/target");
      (fsPromises.access as any).mockRejectedValue(new Error("ENOENT"));

      const result = await fileManager.verifySymlink("/path/to/symlink");

      expect(result).toBe("broken");
    });

    it("should return 'none' for non-symlink", async () => {
      (fsPromises.lstat as any).mockResolvedValue({
        isSymbolicLink: () => false,
      });

      const result = await fileManager.verifySymlink("/path/to/regular");

      expect(result).toBe("none");
    });

    it("should return 'none' for non-existent path", async () => {
      (fsPromises.lstat as any).mockRejectedValue(new Error("ENOENT"));

      const result = await fileManager.verifySymlink("/nonexistent");

      expect(result).toBe("none");
    });
  });

  describe("deleteSkillDirectory", () => {
    it("should delete directory within skills folder", async () => {
      (isPathContained as any).mockReturnValue(true);
      (fsPromises.access as any).mockResolvedValue(undefined);

      const result = await fileManager.deleteSkillDirectory(
        path.join(mockSkillsDir, "my-skill"),
      );

      expect(fsPromises.rm).toHaveBeenCalledWith(
        path.join(mockSkillsDir, "my-skill"),
        { recursive: true, force: true },
      );
      expect(result).toBe(true);
    });

    it("should return false for path outside skills directory", async () => {
      (isPathContained as any).mockReturnValue(false);

      const result = await fileManager.deleteSkillDirectory("/other/path");

      expect(fsPromises.rm).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it("should not delete the skills directory itself", async () => {
      (isPathContained as any).mockReturnValue(true);

      const result = await fileManager.deleteSkillDirectory(mockSkillsDir);

      expect(fsPromises.rm).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe("readSkillMd", () => {
    it("should read SKILL.md from valid path", async () => {
      (isPathContained as any).mockReturnValue(true);
      (fsPromises.access as any).mockResolvedValue(undefined);
      (fsPromises.readFile as any).mockResolvedValue("# Skill Content");

      const result = await fileManager.readSkillMd(
        path.join(mockSkillsDir, "my-skill"),
      );

      expect(result).toBe("# Skill Content");
    });

    it("should return null for path outside skills directory", async () => {
      (isPathContained as any).mockReturnValue(false);

      const result = await fileManager.readSkillMd("/other/path");

      expect(result).toBeNull();
    });

    it("should return null if SKILL.md does not exist", async () => {
      (isPathContained as any).mockReturnValue(true);
      (fsPromises.access as any).mockRejectedValue(
        Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
      );

      const result = await fileManager.readSkillMd(
        path.join(mockSkillsDir, "my-skill"),
      );

      expect(result).toBeNull();
    });
  });

  describe("writeSkillMd", () => {
    it("should write SKILL.md content", async () => {
      (isPathContained as any).mockReturnValue(true);

      await fileManager.writeSkillMd(
        path.join(mockSkillsDir, "my-skill"),
        "# New Content",
      );

      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        path.join(mockSkillsDir, "my-skill", "SKILL.md"),
        "# New Content",
        "utf-8",
      );
    });

    it("should throw for path outside skills directory", async () => {
      (isPathContained as any).mockReturnValue(false);

      await expect(
        fileManager.writeSkillMd("/other/path", "content"),
      ).rejects.toThrow("Security");
    });
  });

  describe("copyFolderToSkills", () => {
    it("should copy folder to skills directory", async () => {
      (validateSkillName as any).mockReturnValue({ valid: true });
      (isPathContained as any).mockReturnValue(true);
      (isPathAllowed as any).mockReturnValue(true);
      // Destination doesn't exist (access throws)
      (fsPromises.access as any).mockRejectedValue(
        Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
      );
      (fsPromises.readdir as any).mockResolvedValue([]);

      const result = await fileManager.copyFolderToSkills(
        "/home/user/my-skill",
        "my-skill",
      );

      expect(fsPromises.mkdir).toHaveBeenCalledWith(
        path.join(mockSkillsDir, "my-skill"),
        { recursive: true },
      );
      expect(result).toBe(path.join(mockSkillsDir, "my-skill"));
    });

    it("should throw for invalid skill name", async () => {
      (validateSkillName as any).mockReturnValue({
        valid: false,
        error: "Invalid",
      });

      await expect(
        fileManager.copyFolderToSkills("/source", "bad name"),
      ).rejects.toThrow("Invalid");
    });

    it("should throw if destination already exists", async () => {
      (validateSkillName as any).mockReturnValue({ valid: true });
      // Destination exists (access succeeds)
      (fsPromises.access as any).mockResolvedValue(undefined);

      await expect(
        fileManager.copyFolderToSkills("/source", "existing"),
      ).rejects.toThrow("already exists");
    });
  });
});
