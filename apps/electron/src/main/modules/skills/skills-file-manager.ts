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

const fsPromises = fs.promises;

/**
 * Maximum depth for recursive directory operations to prevent
 * infinite loops from circular symlinks
 */
const MAX_RECURSION_DEPTH = 50;

/**
 * Skills file system operations manager
 *
 * All filesystem operations are async to avoid blocking the Electron main process.
 *
 * Security features:
 * - Path containment validation prevents directory traversal
 * - Symlink-aware copy operations prevent symlink attacks
 * - Forbidden path checking prevents system directory access
 */
export class SkillsFileManager {
  private skillsDir: string;
  private initPromise: Promise<void>;

  constructor() {
    this.skillsDir = path.join(app.getPath("userData"), "skills");
    this.initPromise = this.ensureDirectory(this.skillsDir);
  }

  /**
   * Wait for initialization (directory creation) to complete.
   * Callers should await this before performing operations.
   */
  async ready(): Promise<void> {
    return this.initPromise;
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
  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fsPromises.access(dirPath);
    } catch {
      await fsPromises.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Create a skill directory with SKILL.md template
   *
   * Security: Validates skill name to prevent path traversal
   */
  async createSkillDirectory(name: string): Promise<string> {
    await this.initPromise;

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

    if (await this.pathExists(skillPath)) {
      throw new Error(`Skill directory already exists: ${name}`);
    }

    await fsPromises.mkdir(skillPath, { recursive: true });

    // Create SKILL.md template
    const skillMdContent = this.generateSkillMdTemplate(name);
    await fsPromises.writeFile(
      path.join(skillPath, "SKILL.md"),
      skillMdContent,
      "utf-8",
    );

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
  async createSymlink(sourcePath: string, targetPath: string): Promise<boolean> {
    await this.initPromise;
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
      await this.ensureDirectory(targetDir);

      // Remove existing symlink or file if exists
      if (await this.pathExists(targetPath) || await this.isSymlinkExists(targetPath)) {
        // Only remove if it's a symlink, not a regular file/directory
        const stats = await fsPromises.lstat(targetPath);
        if (stats.isSymbolicLink()) {
          await fsPromises.unlink(targetPath);
        } else {
          console.error(
            `Security: Cannot overwrite non-symlink at target path: ${targetPath}`,
          );
          return false;
        }
      }

      // Create symlink
      await fsPromises.symlink(sourcePath, targetPath, "dir");
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
   * Check if a path exists (follows symlinks)
   */
  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await fsPromises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a symlink exists (even if broken)
   */
  private async isSymlinkExists(linkPath: string): Promise<boolean> {
    try {
      await fsPromises.lstat(linkPath);
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
  async removeSymlink(symlinkPath: string): Promise<boolean> {
    await this.initPromise;
    try {
      if (await this.isSymlinkExists(symlinkPath)) {
        // Verify it's actually a symlink before removing
        const stats = await fsPromises.lstat(symlinkPath);
        if (!stats.isSymbolicLink()) {
          console.error(
            `Security: Refusing to remove non-symlink: ${symlinkPath}`,
          );
          return false;
        }
        await fsPromises.unlink(symlinkPath);
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
   * Verify symlink status
   */
  async verifySymlink(symlinkPath: string): Promise<SymlinkStatus> {
    await this.initPromise;
    try {
      const lstats = await fsPromises.lstat(symlinkPath);
      if (!lstats.isSymbolicLink()) {
        return "none";
      }

      // Check if target exists
      const targetPath = await fsPromises.readlink(symlinkPath);
      try {
        await fsPromises.access(targetPath);
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
  async deleteSkillDirectory(skillPath: string): Promise<boolean> {
    await this.initPromise;
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

      if (await this.pathExists(skillPath)) {
        await fsPromises.rm(skillPath, { recursive: true, force: true });
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
  async renameSkillDirectory(
    oldPath: string,
    newName: string,
  ): Promise<string | null> {
    await this.initPromise;
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

      if (await this.pathExists(newPath)) {
        throw new Error(`Skill directory already exists: ${newName}`);
      }

      await fsPromises.rename(oldPath, newPath);
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
  async skillExists(name: string): Promise<boolean> {
    await this.initPromise;
    // Validate name before checking
    const validation = validateSkillName(name);
    if (!validation.valid) {
      return false;
    }

    return this.pathExists(path.join(this.skillsDir, name));
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
  async readSkillMd(skillPath: string): Promise<string | null> {
    await this.initPromise;
    // Validate path is within skills directory
    if (!isPathContained(this.skillsDir, skillPath)) {
      console.error(
        `Security: Cannot read from outside skills directory: ${skillPath}`,
      );
      return null;
    }

    const skillMdPath = path.join(skillPath, "SKILL.md");
    try {
      await fsPromises.access(skillMdPath);
      return await fsPromises.readFile(skillMdPath, "utf-8");
    } catch {
      return null;
    }
  }

  /**
   * Read SKILL.md content from managed skills directory (async)
   *
   * Security: Validates path is within skills directory
   *
   * @deprecated Use readSkillMd instead (now async)
   */
  async readSkillMdAsync(skillPath: string): Promise<string | null> {
    return this.readSkillMd(skillPath);
  }

  /**
   * Read SKILL.md content from any allowed path (for discovered skills)
   *
   * Security: Validates path is within user's home directory and is allowed
   */
  async readSkillMdFromPath(skillPath: string): Promise<string | null> {
    // Security: Validate path is allowed (within home directory, not a system path)
    if (!isPathAllowed(skillPath)) {
      console.error(`Security: Cannot read from forbidden path: ${skillPath}`);
      return null;
    }

    const skillMdPath = path.join(skillPath, "SKILL.md");
    try {
      await fsPromises.access(skillMdPath);
      return await fsPromises.readFile(skillMdPath, "utf-8");
    } catch {
      return null;
    }
  }

  /**
   * Write SKILL.md content
   *
   * Security: Validates path is within skills directory
   */
  async writeSkillMd(skillPath: string, content: string): Promise<void> {
    await this.initPromise;
    // Validate path is within skills directory
    if (!isPathContained(this.skillsDir, skillPath)) {
      throw new Error(
        `Security: Cannot write to outside skills directory: ${skillPath}`,
      );
    }

    const skillMdPath = path.join(skillPath, "SKILL.md");
    await fsPromises.writeFile(skillMdPath, content, "utf-8");
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
  async copyFolderToSkills(sourcePath: string, name: string): Promise<string> {
    await this.initPromise;
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

    if (await this.pathExists(destPath)) {
      throw new Error(`Skill directory already exists: ${name}`);
    }

    // Copy directory recursively with symlink safety
    await this.copyDirectoryRecursive(sourcePath, destPath, 0);

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
  private async copyDirectoryRecursive(
    source: string,
    destination: string,
    depth: number,
  ): Promise<void> {
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

    await fsPromises.mkdir(destination, { recursive: true });

    const entries = await fsPromises.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);

      // Skip symlinks for security - don't follow them
      if (entry.isSymbolicLink()) {
        console.warn(`Skipping symlink during copy: ${srcPath}`);
        continue;
      }

      if (entry.isDirectory()) {
        await this.copyDirectoryRecursive(srcPath, destPath, depth + 1);
      } else if (entry.isFile()) {
        await fsPromises.copyFile(srcPath, destPath);
      }
      // Skip other types (sockets, FIFOs, etc.)
    }
  }
}
