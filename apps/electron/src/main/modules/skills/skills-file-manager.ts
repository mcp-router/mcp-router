import fs from "fs";
import path from "path";
import { app, shell } from "electron";

/**
 * Skills file system operations manager
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

  private validateSkillName(name: string): string {
    const normalized = (name ?? "").trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(normalized)) {
      throw new Error("Invalid skill name");
    }
    return normalized;
  }

  private assertPathInside(basePath: string, targetPath: string): string {
    const base = path.resolve(basePath);
    const target = path.resolve(targetPath);
    const relative = path.relative(base, target);
    if (
      relative === "" ||
      (!relative.startsWith("..") && !path.isAbsolute(relative))
    ) {
      return target;
    }
    throw new Error(`Path escapes allowed directory: ${targetPath}`);
  }

  private assertExistingPathInside(
    basePath: string,
    targetPath: string,
  ): string {
    const containedPath = this.assertPathInside(basePath, targetPath);
    if (!fs.existsSync(containedPath)) {
      return containedPath;
    }

    const realBase = fs.realpathSync(basePath);
    const realTarget = fs.realpathSync(containedPath);
    return this.assertPathInside(realBase, realTarget);
  }

  private getSafeSkillPath(name: string): string {
    return this.assertPathInside(
      this.skillsDir,
      path.join(this.skillsDir, this.validateSkillName(name)),
    );
  }

  /**
   * Create a skill directory with SKILL.md template
   */
  createSkillDirectory(name: string): string {
    const skillPath = this.getSafeSkillPath(name);

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
   */
  createSymlink(sourcePath: string, targetPath: string): boolean {
    try {
      // Ensure parent directory exists
      const targetDir = path.dirname(targetPath);
      this.ensureDirectory(targetDir);

      // Remove existing symlink or file if exists
      if (fs.existsSync(targetPath) || this.isSymlinkExists(targetPath)) {
        fs.unlinkSync(targetPath);
      }

      // Create symlink
      fs.symlinkSync(sourcePath, targetPath, "dir");
      return true;
    } catch (error) {
      console.error(
        `Failed to create symlink: ${sourcePath} -> ${targetPath}`,
        error,
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
   */
  removeSymlink(symlinkPath: string): boolean {
    try {
      if (this.isSymlinkExists(symlinkPath)) {
        fs.unlinkSync(symlinkPath);
      }
      return true;
    } catch (error) {
      console.error(`Failed to remove symlink: ${symlinkPath}`, error);
      return false;
    }
  }

  /**
   * Verify symlink status
   */
  verifySymlink(symlinkPath: string): "active" | "broken" | "pending" {
    try {
      const lstats = fs.lstatSync(symlinkPath);
      if (!lstats.isSymbolicLink()) {
        return "broken";
      }

      // Check if target exists
      const targetPath = fs.readlinkSync(symlinkPath);
      if (fs.existsSync(targetPath)) {
        return "active";
      } else {
        return "broken";
      }
    } catch {
      return "pending";
    }
  }

  /**
   * Delete a skill directory and all its contents
   */
  deleteSkillDirectory(skillPath: string): boolean {
    try {
      const safeSkillPath = this.assertExistingPathInside(
        this.skillsDir,
        skillPath,
      );
      if (fs.existsSync(safeSkillPath)) {
        fs.rmSync(safeSkillPath, { recursive: true, force: true });
      }
      return true;
    } catch (error) {
      console.error(`Failed to delete skill directory: ${skillPath}`, error);
      return false;
    }
  }

  /**
   * Rename a skill directory
   */
  renameSkillDirectory(oldPath: string, newName: string): string | null {
    try {
      const safeOldPath = this.assertExistingPathInside(
        this.skillsDir,
        oldPath,
      );
      const newPath = this.getSafeSkillPath(newName);
      if (fs.existsSync(newPath)) {
        throw new Error(`Skill directory already exists: ${newName}`);
      }
      fs.renameSync(safeOldPath, newPath);
      return newPath;
    } catch (error) {
      console.error(
        `Failed to rename skill directory: ${oldPath} -> ${newName}`,
        error,
      );
      return null;
    }
  }

  /**
   * Open folder in system file manager
   */
  openInFinder(folderPath: string): void {
    shell.openPath(folderPath);
  }

  /**
   * Check if a skill directory exists
   */
  skillExists(name: string): boolean {
    return fs.existsSync(this.getSafeSkillPath(name));
  }

  /**
   * Get skill folder path
   */
  getSkillPath(name: string): string {
    return this.getSafeSkillPath(name);
  }

  /**
   * Read SKILL.md content
   */
  readSkillMd(skillPath: string): string | null {
    const safeSkillPath = this.assertExistingPathInside(
      this.skillsDir,
      skillPath,
    );
    const skillMdPath = this.assertExistingPathInside(
      this.skillsDir,
      path.join(safeSkillPath, "SKILL.md"),
    );
    if (!fs.existsSync(skillMdPath)) {
      return null;
    }
    return fs.readFileSync(skillMdPath, "utf-8");
  }

  /**
   * Write SKILL.md content
   */
  writeSkillMd(skillPath: string, content: string): void {
    const safeSkillPath = this.assertExistingPathInside(
      this.skillsDir,
      skillPath,
    );
    const skillMdPath = this.assertPathInside(
      this.skillsDir,
      path.join(safeSkillPath, "SKILL.md"),
    );
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
   */
  copyFolderToSkills(sourcePath: string, name: string): string {
    const destPath = this.getSafeSkillPath(name);

    if (fs.existsSync(destPath)) {
      throw new Error(`Skill directory already exists: ${name}`);
    }

    // Copy directory recursively
    this.copyDirectoryRecursive(sourcePath, destPath);

    return destPath;
  }

  /**
   * Recursively copy a directory
   */
  private copyDirectoryRecursive(source: string, destination: string): void {
    fs.mkdirSync(destination, { recursive: true });

    const entries = fs.readdirSync(source, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);

      if (entry.isSymbolicLink()) {
        throw new Error(
          `Symbolic links are not allowed in skill folders: ${entry.name}`,
        );
      } else if (entry.isDirectory()) {
        this.copyDirectoryRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}
