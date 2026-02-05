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

// Mock fs module
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

describe("SkillsFileManager", () => {
  let fileManager: SkillsFileManager;
  const mockSkillsDir = "/mock/user/data/skills";

  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mocks
    (fs.existsSync as any).mockReturnValue(false);
    fileManager = new SkillsFileManager();
  });

  describe("constructor", () => {
    it("should create skills directory if it does not exist", () => {
      (fs.existsSync as any).mockReturnValue(false);
      new SkillsFileManager();

      expect(fs.mkdirSync).toHaveBeenCalledWith(mockSkillsDir, {
        recursive: true,
      });
    });

    it("should not recreate directory if it exists", () => {
      vi.clearAllMocks();
      (fs.existsSync as any).mockReturnValue(true);
      new SkillsFileManager();

      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe("getSkillsDirectory", () => {
    it("should return the skills directory path", () => {
      expect(fileManager.getSkillsDirectory()).toBe(mockSkillsDir);
    });
  });

  describe("createSkillDirectory", () => {
    it("should create skill directory with SKILL.md", () => {
      (fs.existsSync as any).mockReturnValue(false);
      (validateSkillName as any).mockReturnValue({ valid: true });
      (isPathContained as any).mockReturnValue(true);

      const result = fileManager.createSkillDirectory("my-skill");

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        path.join(mockSkillsDir, "my-skill"),
        { recursive: true },
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join(mockSkillsDir, "my-skill", "SKILL.md"),
        expect.stringContaining("# my-skill"),
        "utf-8",
      );
      expect(result).toBe(path.join(mockSkillsDir, "my-skill"));
    });

    it("should throw error for invalid skill name", () => {
      (validateSkillName as any).mockReturnValue({
        valid: false,
        error: "Invalid name",
      });

      expect(() => fileManager.createSkillDirectory("../bad")).toThrow(
        "Invalid name",
      );
    });

    it("should throw error if directory already exists", () => {
      (validateSkillName as any).mockReturnValue({ valid: true });
      (isPathContained as any).mockReturnValue(true);
      (fs.existsSync as any).mockReturnValue(true);

      expect(() => fileManager.createSkillDirectory("existing")).toThrow(
        "already exists",
      );
    });

    it("should throw error for path traversal", () => {
      (validateSkillName as any).mockReturnValue({ valid: true });
      (isPathContained as any).mockReturnValue(false);

      expect(() => fileManager.createSkillDirectory("skill")).toThrow(
        "path traversal",
      );
    });
  });

  describe("createSymlink", () => {
    it("should create symlink for valid paths", () => {
      (isPathContained as any).mockReturnValue(true);
      (validateSkillSymlinkTarget as any).mockReturnValue({ valid: true });
      (fs.existsSync as any).mockReturnValue(false);

      const result = fileManager.createSymlink(
        path.join(mockSkillsDir, "my-skill"),
        path.join("/home/user/.claude/skills", "my-skill"),
      );

      expect(fs.symlinkSync).toHaveBeenCalledWith(
        path.join(mockSkillsDir, "my-skill"),
        path.join("/home/user/.claude/skills", "my-skill"),
        "dir",
      );
      expect(result).toBe(true);
    });

    it("should return false if source is outside skills directory", () => {
      (isPathContained as any).mockReturnValue(false);

      const result = fileManager.createSymlink(
        "/other/path",
        "/home/user/.claude/skills/my-skill",
      );

      expect(result).toBe(false);
      expect(fs.symlinkSync).not.toHaveBeenCalled();
    });

    it("should return false if target path is not allowed", () => {
      (isPathContained as any).mockReturnValue(true);
      (validateSkillSymlinkTarget as any).mockReturnValue({
        valid: false,
        error: "Not allowed",
      });

      const result = fileManager.createSymlink(
        path.join(mockSkillsDir, "my-skill"),
        "/etc/skills/my-skill",
      );

      expect(result).toBe(false);
    });

    it("should remove existing symlink before creating new one", () => {
      (isPathContained as any).mockReturnValue(true);
      (validateSkillSymlinkTarget as any).mockReturnValue({ valid: true });
      (fs.existsSync as any).mockReturnValue(true);
      (fs.lstatSync as any).mockReturnValue({ isSymbolicLink: () => true });

      fileManager.createSymlink(
        path.join(mockSkillsDir, "my-skill"),
        "/home/user/.claude/skills/my-skill",
      );

      expect(fs.unlinkSync).toHaveBeenCalled();
      expect(fs.symlinkSync).toHaveBeenCalled();
    });

    it("should not overwrite non-symlink files", () => {
      (isPathContained as any).mockReturnValue(true);
      (validateSkillSymlinkTarget as any).mockReturnValue({ valid: true });
      (fs.existsSync as any).mockReturnValue(true);
      (fs.lstatSync as any).mockReturnValue({ isSymbolicLink: () => false });

      const result = fileManager.createSymlink(
        path.join(mockSkillsDir, "my-skill"),
        "/home/user/.claude/skills/my-skill",
      );

      expect(result).toBe(false);
      expect(fs.symlinkSync).not.toHaveBeenCalled();
    });
  });

  describe("removeSymlink", () => {
    it("should remove existing symlink", () => {
      (fs.lstatSync as any).mockReturnValue({ isSymbolicLink: () => true });

      const result = fileManager.removeSymlink("/path/to/symlink");

      expect(fs.unlinkSync).toHaveBeenCalledWith("/path/to/symlink");
      expect(result).toBe(true);
    });

    it("should return false for non-symlink files", () => {
      (fs.lstatSync as any).mockReturnValue({ isSymbolicLink: () => false });

      const result = fileManager.removeSymlink("/path/to/regular-file");

      expect(fs.unlinkSync).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it("should return true for non-existent paths", () => {
      (fs.lstatSync as any).mockImplementation(() => {
        throw new Error("ENOENT");
      });

      const result = fileManager.removeSymlink("/nonexistent/path");

      expect(result).toBe(true);
    });
  });

  describe("verifySymlink", () => {
    it("should return 'active' for valid symlink", () => {
      (fs.lstatSync as any).mockReturnValue({ isSymbolicLink: () => true });
      (fs.readlinkSync as any).mockReturnValue("/target/path");
      (fs.existsSync as any).mockReturnValue(true);

      const result = fileManager.verifySymlink("/path/to/symlink");

      expect(result).toBe("active");
    });

    it("should return 'broken' for symlink with missing target", () => {
      (fs.lstatSync as any).mockReturnValue({ isSymbolicLink: () => true });
      (fs.readlinkSync as any).mockReturnValue("/missing/target");
      (fs.existsSync as any).mockReturnValue(false);

      const result = fileManager.verifySymlink("/path/to/symlink");

      expect(result).toBe("broken");
    });

    it("should return 'none' for non-symlink", () => {
      (fs.lstatSync as any).mockReturnValue({ isSymbolicLink: () => false });

      const result = fileManager.verifySymlink("/path/to/regular");

      expect(result).toBe("none");
    });

    it("should return 'none' for non-existent path", () => {
      (fs.lstatSync as any).mockImplementation(() => {
        throw new Error("ENOENT");
      });

      const result = fileManager.verifySymlink("/nonexistent");

      expect(result).toBe("none");
    });
  });

  describe("deleteSkillDirectory", () => {
    it("should delete directory within skills folder", () => {
      (isPathContained as any).mockReturnValue(true);
      (fs.existsSync as any).mockReturnValue(true);

      const result = fileManager.deleteSkillDirectory(
        path.join(mockSkillsDir, "my-skill"),
      );

      expect(fs.rmSync).toHaveBeenCalledWith(
        path.join(mockSkillsDir, "my-skill"),
        { recursive: true, force: true },
      );
      expect(result).toBe(true);
    });

    it("should return false for path outside skills directory", () => {
      (isPathContained as any).mockReturnValue(false);

      const result = fileManager.deleteSkillDirectory("/other/path");

      expect(fs.rmSync).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it("should not delete the skills directory itself", () => {
      (isPathContained as any).mockReturnValue(true);

      const result = fileManager.deleteSkillDirectory(mockSkillsDir);

      expect(fs.rmSync).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe("readSkillMd", () => {
    it("should read SKILL.md from valid path", () => {
      (isPathContained as any).mockReturnValue(true);
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue("# Skill Content");

      const result = fileManager.readSkillMd(
        path.join(mockSkillsDir, "my-skill"),
      );

      expect(result).toBe("# Skill Content");
    });

    it("should return null for path outside skills directory", () => {
      (isPathContained as any).mockReturnValue(false);

      const result = fileManager.readSkillMd("/other/path");

      expect(result).toBeNull();
    });

    it("should return null if SKILL.md does not exist", () => {
      (isPathContained as any).mockReturnValue(true);
      (fs.existsSync as any).mockReturnValue(false);

      const result = fileManager.readSkillMd(
        path.join(mockSkillsDir, "my-skill"),
      );

      expect(result).toBeNull();
    });
  });

  describe("writeSkillMd", () => {
    it("should write SKILL.md content", () => {
      (isPathContained as any).mockReturnValue(true);

      fileManager.writeSkillMd(
        path.join(mockSkillsDir, "my-skill"),
        "# New Content",
      );

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join(mockSkillsDir, "my-skill", "SKILL.md"),
        "# New Content",
        "utf-8",
      );
    });

    it("should throw for path outside skills directory", () => {
      (isPathContained as any).mockReturnValue(false);

      expect(() => fileManager.writeSkillMd("/other/path", "content")).toThrow(
        "Security",
      );
    });
  });

  describe("copyFolderToSkills", () => {
    it("should copy folder to skills directory", () => {
      (validateSkillName as any).mockReturnValue({ valid: true });
      (isPathContained as any).mockReturnValue(true);
      (isPathAllowed as any).mockReturnValue(true);
      (fs.existsSync as any).mockReturnValue(false);
      (fs.readdirSync as any).mockReturnValue([]);

      const result = fileManager.copyFolderToSkills(
        "/home/user/my-skill",
        "my-skill",
      );

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        path.join(mockSkillsDir, "my-skill"),
        { recursive: true },
      );
      expect(result).toBe(path.join(mockSkillsDir, "my-skill"));
    });

    it("should throw for invalid skill name", () => {
      (validateSkillName as any).mockReturnValue({
        valid: false,
        error: "Invalid",
      });

      expect(() =>
        fileManager.copyFolderToSkills("/source", "bad name"),
      ).toThrow("Invalid");
    });

    it("should throw if destination already exists", () => {
      (validateSkillName as any).mockReturnValue({ valid: true });
      (fs.existsSync as any).mockReturnValue(true);

      expect(() =>
        fileManager.copyFolderToSkills("/source", "existing"),
      ).toThrow("already exists");
    });
  });
});
