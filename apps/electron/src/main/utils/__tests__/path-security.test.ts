import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import os from "os";
import path from "path";
import {
  isPathContained,
  isPathAllowed,
  validateSkillSymlinkTarget,
  validateSkillName,
  safeResolvePath,
  validateCopyOperation,
  validateAgentPath,
} from "../path-security";

describe("path-security", () => {
  const homeDir = os.homedir();

  describe("isPathContained", () => {
    it("should return true for path equal to base", () => {
      expect(isPathContained("/base/path", "/base/path")).toBe(true);
    });

    it("should return true for path within base directory", () => {
      expect(isPathContained("/base/path", "/base/path/sub/dir")).toBe(true);
    });

    it("should return false for path outside base directory", () => {
      expect(isPathContained("/base/path", "/other/path")).toBe(false);
    });

    it("should return false for path traversal attempts", () => {
      expect(isPathContained("/base/path", "/base/path/../other")).toBe(false);
    });

    it("should return false for partial directory name matches", () => {
      // /base/path should not match /base/pathname
      expect(isPathContained("/base/path", "/base/pathname")).toBe(false);
    });

    it("should handle relative paths correctly", () => {
      const base = path.resolve("./base");
      const target = path.resolve("./base/sub");
      expect(isPathContained(base, target)).toBe(true);
    });
  });

  describe("isPathAllowed", () => {
    it("should return true for paths in user directories", () => {
      expect(isPathAllowed(path.join(homeDir, "projects"))).toBe(true);
    });

    it("should return false for /etc", () => {
      expect(isPathAllowed("/etc")).toBe(false);
      expect(isPathAllowed("/etc/passwd")).toBe(false);
    });

    it("should return false for /usr", () => {
      expect(isPathAllowed("/usr")).toBe(false);
      expect(isPathAllowed("/usr/bin")).toBe(false);
    });

    it("should return false for /bin", () => {
      expect(isPathAllowed("/bin")).toBe(false);
    });

    it("should return false for /var", () => {
      expect(isPathAllowed("/var")).toBe(false);
      expect(isPathAllowed("/var/log")).toBe(false);
    });

    it("should be case-insensitive", () => {
      expect(isPathAllowed("/ETC")).toBe(false);
      expect(isPathAllowed("/Usr")).toBe(false);
    });
  });

  describe("validateSkillName", () => {
    it("should accept valid skill names", () => {
      expect(validateSkillName("my-skill")).toEqual({ valid: true });
      expect(validateSkillName("skill_name")).toEqual({ valid: true });
      expect(validateSkillName("Skill123")).toEqual({ valid: true });
    });

    it("should reject empty names", () => {
      expect(validateSkillName("")).toEqual({
        valid: false,
        error: "Skill name cannot be empty",
      });
      expect(validateSkillName("   ")).toEqual({
        valid: false,
        error: "Skill name cannot be empty",
      });
    });

    it("should reject names with path separators", () => {
      const result1 = validateSkillName("my/skill");
      expect(result1.valid).toBe(false);
      expect(result1.error).toContain("path separators");

      const result2 = validateSkillName("my\\skill");
      expect(result2.valid).toBe(false);
    });

    it("should reject path traversal attempts", () => {
      const result = validateSkillName("../secret");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("path separators");
    });

    it("should reject names with special characters", () => {
      const result1 = validateSkillName("my skill");
      expect(result1.valid).toBe(false);

      const result2 = validateSkillName("my@skill");
      expect(result2.valid).toBe(false);
    });

    it("should reject names starting with a dot", () => {
      const result = validateSkillName(".hidden");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("cannot start with a dot");
    });

    it("should reject names exceeding max length", () => {
      const longName = "a".repeat(256);
      const result = validateSkillName(longName);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("255 characters");
    });

    it("should reject null/undefined", () => {
      // @ts-expect-error Testing invalid input
      expect(validateSkillName(null).valid).toBe(false);
      // @ts-expect-error Testing invalid input
      expect(validateSkillName(undefined).valid).toBe(false);
    });
  });

  describe("validateSkillSymlinkTarget", () => {
    it("should accept valid paths in allowed directories", () => {
      const result = validateSkillSymlinkTarget(
        path.join(homeDir, ".claude", "skills"),
      );
      expect(result.valid).toBe(true);
    });

    it("should accept paths in .cursor directory", () => {
      const result = validateSkillSymlinkTarget(
        path.join(homeDir, ".cursor", "skills"),
      );
      expect(result.valid).toBe(true);
    });

    it("should accept paths in .config directory", () => {
      const result = validateSkillSymlinkTarget(
        path.join(homeDir, ".config", "myapp", "skills"),
      );
      expect(result.valid).toBe(true);
    });

    it("should reject paths outside home directory", () => {
      const result = validateSkillSymlinkTarget("/tmp/skills");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("home directory");
    });

    it("should reject forbidden system paths", () => {
      const result = validateSkillSymlinkTarget("/usr/local/skills");
      expect(result.valid).toBe(false);
    });

    it("should reject paths not in allowed base directories", () => {
      const result = validateSkillSymlinkTarget(
        path.join(homeDir, "random-dir", "skills"),
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("allowed agent directory");
    });
  });

  describe("safeResolvePath", () => {
    it("should resolve paths within base directory", () => {
      const result = safeResolvePath("/base/path", "sub/dir");
      expect(result).toBe(path.resolve("/base/path/sub/dir"));
    });

    it("should return null for paths escaping base directory", () => {
      const result = safeResolvePath("/base/path", "../other");
      expect(result).toBeNull();
    });

    it("should handle absolute paths that stay in base", () => {
      const result = safeResolvePath("/base/path", "/base/path/sub");
      expect(result).toBe(path.resolve("/base/path/sub"));
    });
  });

  describe("validateCopyOperation", () => {
    it("should accept valid copy operations", () => {
      const result = validateCopyOperation(
        path.join(homeDir, "source"),
        "/dest/base/sub",
        "/dest/base",
      );
      expect(result.valid).toBe(true);
    });

    it("should reject destination outside allowed base", () => {
      const result = validateCopyOperation(
        path.join(homeDir, "source"),
        "/other/path",
        "/dest/base",
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("destination must be within");
    });

    it("should reject source from forbidden paths", () => {
      const result = validateCopyOperation(
        "/etc/passwd",
        "/dest/base/sub",
        "/dest/base",
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("forbidden system directory");
    });
  });

  describe("validateAgentPath", () => {
    it("should accept valid agent paths with ~", () => {
      const result = validateAgentPath("~/.claude/skills");
      expect(result.valid).toBe(true);
    });

    it("should accept absolute paths in allowed directories", () => {
      const result = validateAgentPath(path.join(homeDir, ".cursor", "skills"));
      expect(result.valid).toBe(true);
    });

    it("should reject empty paths", () => {
      expect(validateAgentPath("").valid).toBe(false);
      expect(validateAgentPath("   ").valid).toBe(false);
    });

    it("should reject paths to forbidden directories", () => {
      const result = validateAgentPath("/etc/something");
      expect(result.valid).toBe(false);
    });
  });
});
