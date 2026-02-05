import fs from "fs";
import path from "path";
import { app, shell } from "electron";
import type { SymlinkStatus } from "@mcp_router/shared";
import {
  isPathContained,
  isPathAllowed,
  validateSkillName,
  validateSkillSymlinkTarget,
  validateCopyOperation,
} from "@/main/utils/path-security";

/**
 * Maximum depth for recursive directory operations to prevent
 * infinite loops from circular symlinks
 */
const MAX_RECURSION_DEPTH = 50;

/**
 * Skills file system operations manager
 *
 * Security features:
 * - Path containment validation prevents directory traversal
 * - Symlink-aware copy operations prevent symlink attacks
 * - Forbidden path checking prevents system directory access
 */
export class SkillsFileManager {
  private skillsDir: string;

  constructor() {
    this.skillsDir = path.join(app.getPath("userData"), "skills");
    this.ensureDirectory(this.skillsDir);
  }

  /**
   * Get the base skills directory path
   */
  getSkillsDirectory(): string {
    return this.skillsDir;
  }

  /**
   * Ensure a directory exists
   */
  private ensureDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Create a skill directory with SKILL.md template
   *
   * Security: Validates skill name to prevent path traversal
   */
  createSkillDirectory(name: string): string {
    // Validate skill name for security
    const validation = validateSkillName(name);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const skillPath = path.join(this.skillsDir, name);

    // Double-check path containment (defense in depth)
    if (!isPathContained(this.skillsDir, skillPath)) {
      throw new Error(`Invalid skill path: path traversal detected`);
    }

    if (fs.existsSync(skillPath)) {
      throw new Error(`Skill directory already exists: ${name}`);
    }

    fs.mkdirSync(skillPath, { recursive: true });

    // Create SKILL.md template
    const skillMdContent = this.generateSkillMdTemplate(name);
    fs.writeFileSync(path.join(skillPath, "SKILL.md"), skillMdContent, "utf-8");

    return skillPath;
  }

  /**
   * Generate SKILL.md template content
   */
  private generateSkillMdTemplate(name: string): string {
    return `# ${name}

<!-- Describe what this skill does -->

## Instructions

<!-- Add your skill instructions here -->
`;
  }

  /**
   * Create a symbolic link
   *
   * Security: Validates that target path is in an allowed location
   */
  createSymlink(sourcePath: string, targetPath: string): boolean {
    try {
      // Validate source is within skills directory
      if (!isPathContained(this.skillsDir, sourcePath)) {
        console.error(
          `Security: Symlink source must be within skills directory: ${sourcePath}`,
        );
        return false;
      }

      // Validate target path is allowed
      const targetValidation = validateSkillSymlinkTarget(targetPath);
      if (!targetValidation.valid) {
        console.error(`Security: ${targetValidation.error}`);
        return false;
      }

      // Ensure parent directory exists
      const targetDir = path.dirname(targetPath);
      this.ensureDirectory(targetDir);

      // Remove existing symlink or file if exists
      if (fs.existsSync(targetPath) || this.isSymlinkExists(targetPath)) {
        // Only remove if it's a symlink, not a regular file/directory
        const stats = fs.lstatSync(targetPath);
        if (stats.isSymbolicLink()) {
          fs.unlinkSync(targetPath);
        } else {
          console.error(
            `Security: Cannot overwrite non-symlink at target path: ${targetPath}`,
          );
          return false;
        }
      }

      // Create symlink
      fs.symlinkSync(sourcePath, targetPath, "dir");
      return true;
    } catch (error) {
      console.error(
        `Failed to create symlink: ${sourcePath} -> ${targetPath}`,
        error instanceof Error ? error.message : "Unknown error",
      );
      return false;
    }
  }

  /**
   * Check if a symlink exists (even if broken)
   */
  private isSymlinkExists(linkPath: string): boolean {
    try {
      fs.lstatSync(linkPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Remove a symbolic link
   *
   * Security: Only removes symlinks, not regular files or directories
   */
  removeSymlink(symlinkPath: string): boolean {
    try {
      if (this.isSymlinkExists(symlinkPath)) {
        // Verify it's actually a symlink before removing
        const stats = fs.lstatSync(symlinkPath);
        if (!stats.isSymbolicLink()) {
          console.error(
            `Security: Refusing to remove non-symlink: ${symlinkPath}`,
          );
          return false;
        }
        fs.unlinkSync(symlinkPath);
      }
      return true;
    } catch (error) {
      console.error(
        `Failed to remove symlink: ${symlinkPath}`,
        error instanceof Error ? error.message : "Unknown error",
      );
      return false;
    }
  }

  /**
   * Verify symlink status (async)
   */
  async verifySymlink(symlinkPath: string): Promise<SymlinkStatus> {
    try {
      const lstats = await fs.promises.lstat(symlinkPath);
      if (!lstats.isSymbolicLink()) {
        return "none";
      }

      // Check if target exists
      const targetPath = await fs.promises.readlink(symlinkPath);
      try {
        await fs.promises.access(targetPath);
        return "active";
      } catch {
        return "broken";
      }
    } catch {
      return "none";
    }
  }

  /**
   * Delete a skill directory and all its contents
   *
   * Security: Validates path is within skills directory before deletion
   */
  deleteSkillDirectory(skillPath: string): boolean {
    try {
      // Critical security check: ensure path is within skills directory
      if (!isPathContained(this.skillsDir, skillPath)) {
        console.error(
          `Security: Cannot delete directory outside skills folder: ${skillPath}`,
        );
        return false;
      }

      // Additional check: path should not be the skills directory itself
      if (path.resolve(skillPath) === path.resolve(this.skillsDir)) {
        console.error(`Security: Cannot delete the skills directory itself`);
        return false;
      }

      if (fs.existsSync(skillPath)) {
        fs.rmSync(skillPath, { recursive: true, force: true });
      }
      return true;
    } catch (error) {
      console.error(
        `Failed to delete skill directory: ${skillPath}`,
        error instanceof Error ? error.message : "Unknown error",
      );
      return false;
    }
  }

  /**
   * Rename a skill directory
   *
   * Security: Validates both old and new paths are within skills directory
   */
  renameSkillDirectory(oldPath: string, newName: string): string | null {
    try {
      // Validate new name
      const nameValidation = validateSkillName(newName);
      if (!nameValidation.valid) {
        throw new Error(nameValidation.error);
      }

      // Validate old path is within skills directory
      if (!isPathContained(this.skillsDir, oldPath)) {
        throw new Error(`Cannot rename directory outside skills folder`);
      }

      const newPath = path.join(this.skillsDir, newName);

      // Validate new path is within skills directory (defense in depth)
      if (!isPathContained(this.skillsDir, newPath)) {
        throw new Error(`Invalid new path: path traversal detected`);
      }

      if (fs.existsSync(newPath)) {
        throw new Error(`Skill directory already exists: ${newName}`);
      }

      fs.renameSync(oldPath, newPath);
      return newPath;
    } catch (error) {
      console.error(
        `Failed to rename skill directory: ${oldPath} -> ${newName}`,
        error instanceof Error ? error.message : "Unknown error",
      );
      return null;
    }
  }

  /**
   * Open folder in system file manager
   *
   * Security: Validates path is within skills directory
   */
  openInFinder(folderPath: string): void {
    // Only allow opening skills directory or subdirectories
    if (!isPathContained(this.skillsDir, folderPath)) {
      console.error(
        `Security: Cannot open folder outside skills directory: ${folderPath}`,
      );
      return;
    }

    shell.openPath(folderPath);
  }

  /**
   * Check if a skill directory exists
   */
  skillExists(name: string): boolean {
    // Validate name before checking
    const validation = validateSkillName(name);
    if (!validation.valid) {
      return false;
    }

    return fs.existsSync(path.join(this.skillsDir, name));
  }

  /**
   * Get skill folder path
   *
   * Security: Validates skill name and ensures path containment
   */
  getSkillPath(name: string): string {
    // Validate skill name
    const validation = validateSkillName(name);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const skillPath = path.join(this.skillsDir, name);

    // Defense in depth: verify containment
    if (!isPathContained(this.skillsDir, skillPath)) {
      throw new Error(`Invalid skill path: path traversal detected`);
    }

    return skillPath;
  }

  /**
   * Read SKILL.md content from managed skills directory
   *
   * Security: Validates path is within skills directory
   */
  readSkillMd(skillPath: string): string | null {
    // Validate path is within skills directory
    if (!isPathContained(this.skillsDir, skillPath)) {
      console.error(
        `Security: Cannot read from outside skills directory: ${skillPath}`,
      );
      return null;
    }

    const skillMdPath = path.join(skillPath, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) {
      return null;
    }
    return fs.readFileSync(skillMdPath, "utf-8");
  }

  /**
   * Read SKILL.md content from managed skills directory (async)
   *
   * Security: Validates path is within skills directory
   */
  async readSkillMdAsync(skillPath: string): Promise<string | null> {
    // Validate path is within skills directory
    if (!isPathContained(this.skillsDir, skillPath)) {
      console.error(
        `Security: Cannot read from outside skills directory: ${skillPath}`,
      );
      return null;
    }

    const skillMdPath = path.join(skillPath, "SKILL.md");
    try {
      await fs.promises.access(skillMdPath);
      return await fs.promises.readFile(skillMdPath, "utf-8");
    } catch {
      return null;
    }
  }

  /**
   * Read SKILL.md content from any allowed path (for discovered skills)
   *
   * Security: Validates path is within user's home directory and is allowed
   */
  readSkillMdFromPath(skillPath: string): string | null {
    // Security: Validate path is allowed (within home directory, not a system path)
    if (!isPathAllowed(skillPath)) {
      console.error(`Security: Cannot read from forbidden path: ${skillPath}`);
      return null;
    }

    const skillMdPath = path.join(skillPath, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) {
      return null;
    }

    return fs.readFileSync(skillMdPath, "utf-8");
  }

  /**
   * Write SKILL.md content
   *
   * Security: Validates path is within skills directory
   */
  writeSkillMd(skillPath: string, content: string): void {
    // Validate path is within skills directory
    if (!isPathContained(this.skillsDir, skillPath)) {
      throw new Error(
        `Security: Cannot write to outside skills directory: ${skillPath}`,
      );
    }

    const skillMdPath = path.join(skillPath, "SKILL.md");
    fs.writeFileSync(skillMdPath, content, "utf-8");
  }

  /**
   * Extract folder name from path
   */
  extractFolderName(folderPath: string): string {
    return path.basename(folderPath);
  }

  /**
   * Copy an external folder to skills directory
   *
   * Security:
   * - Validates destination is within skills directory
   * - Validates source is not a forbidden system path
   * - Does not follow symlinks (copies symlinks as-is or skips them)
   */
  copyFolderToSkills(sourcePath: string, name: string): string {
    // Validate skill name
    const nameValidation = validateSkillName(name);
    if (!nameValidation.valid) {
      throw new Error(nameValidation.error);
    }

    const destPath = path.join(this.skillsDir, name);

    // Validate copy operation
    const copyValidation = validateCopyOperation(
      sourcePath,
      destPath,
      this.skillsDir,
    );
    if (!copyValidation.valid) {
      throw new Error(copyValidation.error);
    }

    if (fs.existsSync(destPath)) {
      throw new Error(`Skill directory already exists: ${name}`);
    }

    // Copy directory recursively with symlink safety
    this.copyDirectoryRecursive(sourcePath, destPath, 0);

    return destPath;
  }

  /**
   * Recursively copy a directory
   *
   * Security:
   * - Limits recursion depth to prevent infinite loops
   * - Skips symlinks to prevent symlink attacks
   * - Validates paths at each level
   */
  private copyDirectoryRecursive(
    source: string,
    destination: string,
    depth: number,
  ): void {
    // Prevent infinite recursion (e.g., from circular symlinks)
    if (depth > MAX_RECURSION_DEPTH) {
      throw new Error(
        `Maximum recursion depth exceeded while copying directory`,
      );
    }

    // Validate source is allowed
    if (!isPathAllowed(source)) {
      throw new Error(`Cannot copy from forbidden path: ${source}`);
    }

    fs.mkdirSync(destination, { recursive: true });

    const entries = fs.readdirSync(source, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);

      // Skip symlinks for security - don't follow them
      if (entry.isSymbolicLink()) {
        console.warn(`Skipping symlink during copy: ${srcPath}`);
        continue;
      }

      if (entry.isDirectory()) {
        this.copyDirectoryRecursive(srcPath, destPath, depth + 1);
      } else if (entry.isFile()) {
        fs.copyFileSync(srcPath, destPath);
      }
      // Skip other types (sockets, FIFOs, etc.)
    }
  }
}
