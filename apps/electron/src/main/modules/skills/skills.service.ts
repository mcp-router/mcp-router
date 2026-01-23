import { SingletonService } from "@/main/modules/singleton-service";
import { SkillRepository } from "./skills.repository";
import { SkillsFileManager } from "./skills-file-manager";
import { SUPPORTED_AGENTS, getSymlinkTargetPath } from "./skills-agent-paths";
import { dialog } from "electron";
import type {
  Skill,
  SkillWithContent,
  CreateSkillInput,
  UpdateSkillInput,
} from "@mcp_router/shared";

/**
 * Skills service for managing agent skills
 */
export class SkillService extends SingletonService<
  Skill,
  string,
  SkillService
> {
  private fileManager: SkillsFileManager;

  protected constructor() {
    super();
    this.fileManager = new SkillsFileManager();
  }

  protected getEntityName(): string {
    return "Skill";
  }

  public static getInstance(): SkillService {
    return (this as any).getInstanceBase();
  }

  public static resetInstance(): void {
    this.resetInstanceBase(SkillService);
  }

  /**
   * List all skills with their content
   */
  list(): SkillWithContent[] {
    try {
      const repo = SkillRepository.getInstance();
      const skills = repo.getAll({ orderBy: "name" });

      return skills.map((skill) => ({
        ...skill,
        content: this.fileManager.readSkillMd(
          this.fileManager.getSkillPath(skill.name),
        ),
      }));
    } catch (error) {
      return this.handleError("list", error, []);
    }
  }

  /**
   * Create a new skill with automatic symlink creation
   */
  create(input: CreateSkillInput): Skill {
    try {
      const repo = SkillRepository.getInstance();
      const name = this.validateAndNormalizeName(input.name);

      // Check for duplicate
      const duplicate = repo.findByName(name);
      if (duplicate) {
        throw new Error(`Skill "${name}" already exists`);
      }

      // Create skill directory
      this.fileManager.createSkillDirectory(name);

      const now = Date.now();
      const skill = repo.add({
        name,
        projectId: input.projectId ?? null,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      } as Omit<Skill, "id">);

      // Create symlinks for all agents
      this.createSymlinksForAllAgents(skill.name);

      return skill;
    } catch (error) {
      return this.handleError("create", error);
    }
  }

  /**
   * Update a skill (including enabled state and content)
   */
  update(id: string, updates: UpdateSkillInput): Skill {
    try {
      const repo = SkillRepository.getInstance();
      const existing = repo.getById(id);

      if (!existing) {
        throw new Error("Skill not found");
      }

      let nextName = existing.name;
      let nextEnabled = existing.enabled;

      // Handle name change (directory rename)
      if (updates.name !== undefined && updates.name !== existing.name) {
        const name = this.validateAndNormalizeName(updates.name);
        const duplicate = repo.findByName(name);

        if (duplicate && duplicate.id !== id) {
          throw new Error(`Skill "${name}" already exists`);
        }

        // Remove old symlinks before rename
        this.removeSymlinksForAllAgents(existing.name);

        // Rename directory
        const oldPath = this.fileManager.getSkillPath(existing.name);
        const newPath = this.fileManager.renameSkillDirectory(oldPath, name);

        if (!newPath) {
          throw new Error(`Failed to rename skill directory`);
        }

        nextName = name;

        // Create new symlinks with updated name
        if (nextEnabled) {
          this.createSymlinksForAllAgents(nextName);
        }
      }

      // Handle content update
      if (updates.content !== undefined) {
        const skillPath = this.fileManager.getSkillPath(nextName);
        this.fileManager.writeSkillMd(skillPath, updates.content);
      }

      // Handle enabled state change
      if (
        updates.enabled !== undefined &&
        updates.enabled !== existing.enabled
      ) {
        nextEnabled = updates.enabled;
        if (nextEnabled) {
          // Create symlinks for all agents
          this.createSymlinksForAllAgents(nextName);
        } else {
          // Remove all symlinks
          this.removeSymlinksForAllAgents(nextName);
        }
      }

      const merged: Skill = {
        ...existing,
        name: nextName,
        projectId:
          updates.projectId !== undefined
            ? updates.projectId
            : existing.projectId,
        enabled: nextEnabled,
        updatedAt: Date.now(),
      };

      const result = repo.update(id, merged);
      if (!result) {
        throw new Error("Failed to update skill");
      }

      return result;
    } catch (error) {
      return this.handleError("update", error);
    }
  }

  /**
   * Delete a skill and all its symlinks
   */
  delete(id: string): void {
    try {
      const repo = SkillRepository.getInstance();
      const skill = repo.getById(id);

      if (!skill) {
        throw new Error("Skill not found");
      }

      // Remove all symlinks
      this.removeSymlinksForAllAgents(skill.name);

      // Delete skill directory
      const skillPath = this.fileManager.getSkillPath(skill.name);
      this.fileManager.deleteSkillDirectory(skillPath);

      // Delete from database
      const ok = repo.delete(id);
      if (!ok) {
        throw new Error("Failed to delete skill");
      }
    } catch (error) {
      this.handleError("delete", error);
    }
  }

  /**
   * Open skill folder in system file manager
   * If id is not provided, opens the skills directory
   */
  openFolder(id?: string): void {
    try {
      if (!id) {
        // Open skills directory
        this.fileManager.openInFinder(this.fileManager.getSkillsDirectory());
        return;
      }

      const repo = SkillRepository.getInstance();
      const skill = repo.getById(id);

      if (!skill) {
        throw new Error("Skill not found");
      }

      const skillPath = this.fileManager.getSkillPath(skill.name);
      this.fileManager.openInFinder(skillPath);
    } catch (error) {
      this.handleError("openFolder", error);
    }
  }

  /**
   * Import a skill from an external folder (with folder selection dialog)
   */
  async import(): Promise<Skill> {
    try {
      // Show folder selection dialog
      const result = await dialog.showOpenDialog({
        properties: ["openDirectory"],
        title: "Select Skill Folder",
      });

      if (result.canceled || result.filePaths.length === 0) {
        throw new Error("No folder selected");
      }

      const sourcePath = result.filePaths[0];
      const repo = SkillRepository.getInstance();

      // Extract folder name as skill name
      const name = this.fileManager.extractFolderName(sourcePath);
      const normalizedName = this.validateAndNormalizeName(name);

      // Check for duplicate
      const duplicate = repo.findByName(normalizedName);
      if (duplicate) {
        throw new Error(`Skill "${normalizedName}" already exists`);
      }

      // Copy folder to skills directory
      this.fileManager.copyFolderToSkills(sourcePath, normalizedName);

      const now = Date.now();
      const skill = repo.add({
        name: normalizedName,
        projectId: null,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      } as Omit<Skill, "id">);

      // Create symlinks for all agents
      this.createSymlinksForAllAgents(skill.name);

      return skill;
    } catch (error) {
      return this.handleError("import", error);
    }
  }

  /**
   * Verify all symlinks and repair broken ones on startup
   */
  verifyAndRepairSymlinks(): void {
    try {
      const repo = SkillRepository.getInstance();
      const skills = repo.getAll();

      for (const skill of skills) {
        if (skill.enabled) {
          // Recreate symlinks for enabled skills (this also repairs broken ones)
          this.createSymlinksForAllAgents(skill.name);
        } else {
          // Ensure symlinks are removed for disabled skills
          this.removeSymlinksForAllAgents(skill.name);
        }
      }
    } catch (error) {
      this.handleError("verifyAndRepairSymlinks", error);
    }
  }

  /**
   * Create symlinks for all supported agents
   */
  private createSymlinksForAllAgents(skillName: string): void {
    const skillPath = this.fileManager.getSkillPath(skillName);
    for (const agentType of SUPPORTED_AGENTS) {
      const targetPath = getSymlinkTargetPath(agentType, skillName);
      this.fileManager.createSymlink(skillPath, targetPath);
    }
  }

  /**
   * Remove symlinks for all supported agents
   */
  private removeSymlinksForAllAgents(skillName: string): void {
    for (const agentType of SUPPORTED_AGENTS) {
      const targetPath = getSymlinkTargetPath(agentType, skillName);
      this.fileManager.removeSymlink(targetPath);
    }
  }

  /**
   * Validate and normalize skill name
   */
  private validateAndNormalizeName(input: string): string {
    const name = (input ?? "").trim();

    if (!name) {
      throw new Error("Skill name cannot be empty");
    }

    // Only allow characters valid for directory names
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new Error(
        "Skill name can only contain letters, numbers, underscores, and hyphens",
      );
    }

    return name;
  }
}

/**
 * Get the skill service instance
 */
export function getSkillService(): SkillService {
  return SkillService.getInstance();
}
