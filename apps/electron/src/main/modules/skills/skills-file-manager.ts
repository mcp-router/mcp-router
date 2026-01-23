import fs from "fs";
import path from "path";
import { app, shell } from "electron";

type SymlinkStatus = "active" | "broken" | "pending";

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

  /**
   * Create a skill directory with SKILL.md template
   */
  createSkillDirectory(name: string): string {
    const skillPath = path.join(this.skillsDir, name);

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
  verifySymlink(symlinkPath: string): SymlinkStatus {
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
      if (fs.existsSync(skillPath)) {
        fs.rmSync(skillPath, { recursive: true, force: true });
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
      const newPath = path.join(this.skillsDir, newName);
      if (fs.existsSync(newPath)) {
        throw new Error(`Skill directory already exists: ${newName}`);
      }
      fs.renameSync(oldPath, newPath);
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
    return fs.existsSync(path.join(this.skillsDir, name));
  }

  /**
   * Get skill folder path
   */
  getSkillPath(name: string): string {
    return path.join(this.skillsDir, name);
  }

  /**
   * Read SKILL.md content
   */
  readSkillMd(skillPath: string): string | null {
    const skillMdPath = path.join(skillPath, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) {
      return null;
    }
    return fs.readFileSync(skillMdPath, "utf-8");
  }

  /**
   * Write SKILL.md content
   */
  writeSkillMd(skillPath: string, content: string): void {
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
   */
  copyFolderToSkills(sourcePath: string, name: string): string {
    const destPath = path.join(this.skillsDir, name);

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

      if (entry.isDirectory()) {
        this.copyDirectoryRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}
