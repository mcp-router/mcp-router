import { SingletonService } from "@/main/modules/singleton-service";
import { SkillRepository } from "./skills.repository";
import { ClientSkillStateRepository } from "./client-skill-state.repository";
import { SkillsFileManager } from "./skills-file-manager";
import { AgentPathRepository } from "./agent-path.repository";
import { getSymlinkTargetPath } from "./skills-agent-paths";
import { dialog } from "electron";
import {
  validateAgentPath,
  validateSkillName,
} from "@/main/utils/path-security";
import type {
  Skill,
  SkillWithContent,
  CreateSkillInput,
  UpdateSkillInput,
  AgentPath,
  CreateAgentPathInput,
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
   * List all skills without content (for performance)
   *
   * Performance optimization: Returns skills without SKILL.md content.
   * Use getContent(id) to load content on-demand when needed.
   */
  list(): Skill[] {
    try {
      const repo = SkillRepository.getInstance();
      return repo.getAll({ orderBy: "name" });
    } catch (error) {
      return this.handleError("list", error, []);
    }
  }

  /**
   * List all skills with their content (legacy method)
   *
   * @deprecated Use list() for listing and getContent() for content loading
   */
  listWithContent(): SkillWithContent[] {
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
      return this.handleError("listWithContent", error, []);
    }
  }

  /**
   * Get a single skill by ID
   */
  get(id: string): Skill | null {
    try {
      const repo = SkillRepository.getInstance();
      return repo.getById(id) || null;
    } catch (error) {
      return this.handleError("get", error, null);
    }
  }

  /**
   * Get SKILL.md content for a specific skill (lazy loading)
   *
   * Performance optimization: Load content on-demand instead of with list()
   */
  getContent(id: string): string | null {
    try {
      const repo = SkillRepository.getInstance();
      const skill = repo.getById(id);

      if (!skill) {
        return null;
      }

      const skillPath = this.fileManager.getSkillPath(skill.name);
      return this.fileManager.readSkillMd(skillPath);
    } catch (error) {
      return this.handleError("getContent", error, null);
    }
  }

  /**
   * Get skill with content by ID
   */
  getWithContent(id: string): SkillWithContent | null {
    try {
      const repo = SkillRepository.getInstance();
      const skill = repo.getById(id);

      if (!skill) {
        return null;
      }

      const skillPath = this.fileManager.getSkillPath(skill.name);
      const content = this.fileManager.readSkillMd(skillPath);

      return {
        ...skill,
        content,
      };
    } catch (error) {
      return this.handleError("getWithContent", error, null);
    }
  }

  /**
   * Get SKILL.md content from a specific path (for discovered skills)
   *
   * This allows loading content from skills that are not managed by the router
   * but were discovered in client directories.
   */
  getContentFromPath(skillPath: string): string | null {
    try {
      return this.fileManager.readSkillMdFromPath(skillPath);
    } catch (error) {
      return this.handleError("getContentFromPath", error, null);
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

      // Clean up client skill state records
      ClientSkillStateRepository.getInstance().deleteBySkill(id);

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
   * Create symlinks for all agent paths from database
   *
   * Performance note: Uses cached agent paths to avoid repeated DB queries
   */
  private createSymlinksForAllAgents(skillName: string): void {
    const skillPath = this.fileManager.getSkillPath(skillName);
    const agentPaths = this.getCachedAgentPaths();

    for (const agentPath of agentPaths) {
      const targetPath = getSymlinkTargetPath(agentPath.path, skillName);
      this.fileManager.createSymlink(skillPath, targetPath);
    }
  }

  /**
   * Remove symlinks for all agent paths from database
   *
   * Performance note: Uses cached agent paths to avoid repeated DB queries
   */
  private removeSymlinksForAllAgents(skillName: string): void {
    const agentPaths = this.getCachedAgentPaths();

    for (const agentPath of agentPaths) {
      const targetPath = getSymlinkTargetPath(agentPath.path, skillName);
      this.fileManager.removeSymlink(targetPath);
    }
  }

  /**
   * Batch create symlinks for multiple skills
   *
   * Performance optimization: Caches agent paths and creates symlinks
   * for multiple skills in a single operation
   */
  batchCreateSymlinks(skillNames: string[]): void {
    const agentPaths = this.getCachedAgentPaths();

    for (const skillName of skillNames) {
      const skillPath = this.fileManager.getSkillPath(skillName);
      for (const agentPath of agentPaths) {
        const targetPath = getSymlinkTargetPath(agentPath.path, skillName);
        this.fileManager.createSymlink(skillPath, targetPath);
      }
    }
  }

  /**
   * Batch remove symlinks for multiple skills
   *
   * Performance optimization: Caches agent paths and removes symlinks
   * for multiple skills in a single operation
   */
  batchRemoveSymlinks(skillNames: string[]): void {
    const agentPaths = this.getCachedAgentPaths();

    for (const skillName of skillNames) {
      for (const agentPath of agentPaths) {
        const targetPath = getSymlinkTargetPath(agentPath.path, skillName);
        this.fileManager.removeSymlink(targetPath);
      }
    }
  }

  /**
   * Get cached agent paths (cache for duration of operation)
   */
  private cachedAgentPaths: AgentPath[] | null = null;

  private getCachedAgentPaths(): AgentPath[] {
    if (this.cachedAgentPaths === null) {
      const agentPathRepo = AgentPathRepository.getInstance();
      this.cachedAgentPaths = agentPathRepo.getAll();
    }
    return this.cachedAgentPaths;
  }

  /**
   * Invalidate agent paths cache (call when agent paths change)
   */
  invalidateAgentPathsCache(): void {
    this.cachedAgentPaths = null;
  }

  /**
   * Validate and normalize skill name
   *
   * Security: Uses centralized validation to prevent path traversal attacks
   */
  private validateAndNormalizeName(input: string): string {
    const name = (input ?? "").trim();

    // Use centralized security validation
    const validation = validateSkillName(name);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    return name;
  }

  // ==========================================================================
  // Agent Path Management
  // ==========================================================================

  /**
   * List all agent paths
   */
  listAgentPaths(): AgentPath[] {
    try {
      const repo = AgentPathRepository.getInstance();
      return repo.getAll({ orderBy: "name" });
    } catch (error) {
      return this.handleError("listAgentPaths", error, []);
    }
  }

  /**
   * Create a new agent path
   *
   * Security: Validates that the path is in an allowed location to prevent
   * symlinks being created in sensitive system directories.
   */
  createAgentPath(input: CreateAgentPathInput): AgentPath {
    try {
      const repo = AgentPathRepository.getInstance();
      const name = input.name.trim();
      const pathValue = input.path.trim();

      if (!name) {
        throw new Error("Agent path name cannot be empty");
      }

      if (!pathValue) {
        throw new Error("Agent path cannot be empty");
      }

      // SECURITY: Validate agent path is in an allowed location
      // This prevents symlink attacks to sensitive directories like /etc, /usr, etc.
      const pathValidation = validateAgentPath(pathValue);
      if (!pathValidation.valid) {
        throw new Error(pathValidation.error);
      }

      // Check for duplicate name
      const duplicate = repo.findByName(name);
      if (duplicate) {
        throw new Error(`Agent path "${name}" already exists`);
      }

      const now = Date.now();
      const agentPath = repo.add({
        name,
        path: pathValue,
        createdAt: now,
        updatedAt: now,
      } as Omit<AgentPath, "id">);

      // Invalidate cache since we added a new agent path
      this.invalidateAgentPathsCache();

      // Create symlinks for all enabled skills to this new agent path
      const skillRepo = SkillRepository.getInstance();
      const skills = skillRepo.getAll();
      for (const skill of skills) {
        if (skill.enabled) {
          const skillPath = this.fileManager.getSkillPath(skill.name);
          const targetPath = getSymlinkTargetPath(pathValue, skill.name);
          this.fileManager.createSymlink(skillPath, targetPath);
        }
      }

      return agentPath;
    } catch (error) {
      return this.handleError("createAgentPath", error);
    }
  }

  /**
   * Delete an agent path
   */
  deleteAgentPath(id: string): void {
    try {
      const repo = AgentPathRepository.getInstance();
      const agentPath = repo.getById(id);

      if (!agentPath) {
        throw new Error("Agent path not found");
      }

      // Remove symlinks for all skills from this agent path
      const skillRepo = SkillRepository.getInstance();
      const skills = skillRepo.getAll();
      for (const skill of skills) {
        const targetPath = getSymlinkTargetPath(agentPath.path, skill.name);
        this.fileManager.removeSymlink(targetPath);
      }

      // Delete from database
      const ok = repo.delete(id);
      if (!ok) {
        throw new Error("Failed to delete agent path");
      }

      // Invalidate cache since we removed an agent path
      this.invalidateAgentPathsCache();
    } catch (error) {
      this.handleError("deleteAgentPath", error);
    }
  }

  /**
   * Open folder selection dialog for agent path
   */
  async selectAgentPathFolder(): Promise<string> {
    try {
      const result = await dialog.showOpenDialog({
        properties: ["openDirectory"],
        title: "Select Agent Skills Folder",
      });

      if (result.canceled || result.filePaths.length === 0) {
        throw new Error("No folder selected");
      }

      return result.filePaths[0];
    } catch (error) {
      return this.handleError("selectAgentPathFolder", error);
    }
  }
}

/**
 * Get the skill service instance
 */
export function getSkillService(): SkillService {
  return SkillService.getInstance();
}
