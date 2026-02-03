import * as fs from "fs";
import { promises as fsPromises } from "fs";
import path from "path";
import { SingletonService } from "@/main/modules/singleton-service";
import { SkillRepository } from "./skills.repository";
import { ClientSkillStateRepository } from "./client-skill-state.repository";
import { SkillsFileManager } from "./skills-file-manager";
import { getClientAppService } from "@/main/modules/client-apps/client-app.service";
import {
  resolveGlobPath,
  expandHomePath,
} from "@/main/modules/client-apps/client-detector";
// Note: getSymlinkTargetPath is available from skills-agent-paths if needed
import type {
  Skill,
  UnifiedSkill,
  ClientSkillSummary,
  ClientSkillState,
  ClientSkillStateType,
  SkillSyncResult,
  SkillVerifyResult,
  SkillSource,
  SymlinkStatus,
  DiscoveredSkill,
  ClientApp,
  UpdateUnifiedSkillInput,
} from "@mcp_router/shared";

/**
 * Unified Skills Service
 *
 * Manages skills across multiple AI clients with per-client state tracking.
 * Provides unified view of local and discovered skills, handles symlink
 * operations, and supports bulk sync operations.
 */
export class UnifiedSkillsService extends SingletonService<
  UnifiedSkill,
  string,
  UnifiedSkillsService
> {
  private fileManager: SkillsFileManager;

  protected constructor() {
    super();
    this.fileManager = new SkillsFileManager();
  }

  protected getEntityName(): string {
    return "UnifiedSkill";
  }

  public static getInstance(): UnifiedSkillsService {
    return (this as any).getInstanceBase();
  }

  public static resetInstance(): void {
    this.resetInstanceBase(UnifiedSkillsService);
  }

  // ==========================================================================
  // Core Operations
  // ==========================================================================

  /**
   * List all unified skills combining local skills with discovered skills
   * Adds per-client state information to each skill
   */
  public async listUnified(): Promise<UnifiedSkill[]> {
    try {
      const skillRepo = SkillRepository.getInstance();
      const clientAppService = getClientAppService();

      // Get all local skills from database
      const localSkills = skillRepo.getAll({ orderBy: "name" });

      // Get all discovered skills from client directories
      const discoveredSkills =
        await clientAppService.discoverSkillsFromClients();

      // Get all clients for building client states
      const clients = await clientAppService.list();

      // Build unified skills from local skills
      const unifiedSkills: UnifiedSkill[] = [];
      const processedNames = new Set<string>();

      // Process local skills first (they take precedence)
      for (const skill of localSkills) {
        const clientStates = await this.buildClientStates(
          skill.id,
          skill.name,
          clients,
        );
        const content = this.fileManager.readSkillMd(
          this.fileManager.getSkillPath(skill.name),
        );

        unifiedSkills.push({
          id: skill.id,
          name: skill.name,
          content,
          source: "local" as SkillSource,
          originClientId: undefined,
          clientStates,
          globalSync: skill.enabled, // Use enabled flag as globalSync indicator
          projectId: skill.projectId,
          createdAt: skill.createdAt,
          updatedAt: skill.updatedAt,
        });

        processedNames.add(skill.name.toLowerCase());
      }

      // Process discovered skills that are not already local
      for (const discovered of discoveredSkills) {
        const nameLower = discovered.skillName.toLowerCase();

        // Skip if already processed as local skill
        if (processedNames.has(nameLower)) {
          continue;
        }

        // Skip symlinks that point to our managed skills directory
        if (discovered.isSymlink && discovered.symlinkTarget) {
          const skillsDir = this.fileManager.getSkillsDirectory();
          if (discovered.symlinkTarget.startsWith(skillsDir)) {
            continue;
          }
        }

        // Create unified skill from discovered skill
        const clientStates = await this.buildClientStatesForDiscovered(
          discovered,
          clients,
        );

        // Read content if available
        let content: string | null = null;
        if (discovered.hasSkillMd) {
          try {
            const skillMdPath = path.join(discovered.skillPath, "SKILL.md");
            content = await fsPromises.readFile(skillMdPath, "utf-8");
          } catch {
            // Failed to read content
          }
        }

        const now = Date.now();
        unifiedSkills.push({
          id: `discovered:${discovered.sourceClientId}:${discovered.skillName}`,
          name: discovered.skillName,
          content,
          source: "discovered" as SkillSource,
          originClientId: discovered.sourceClientId,
          clientStates,
          globalSync: false,
          projectId: null,
          createdAt: now,
          updatedAt: now,
        });

        processedNames.add(nameLower);
      }

      return unifiedSkills;
    } catch (error) {
      return this.handleError("listUnified", error, []);
    }
  }

  /**
   * Get a single unified skill by ID with all client states
   */
  public async getUnified(skillId: string): Promise<UnifiedSkill | null> {
    try {
      const clientAppService = getClientAppService();
      const clients = await clientAppService.list();

      // Check if it's a discovered skill ID
      if (skillId.startsWith("discovered:")) {
        const parts = skillId.split(":");
        if (parts.length >= 3) {
          const sourceClientId = parts[1];
          const skillName = parts.slice(2).join(":");

          // Find the discovered skill
          const discoveredSkills =
            await clientAppService.discoverSkillsFromClients();
          const discovered = discoveredSkills.find(
            (d) =>
              d.sourceClientId === sourceClientId && d.skillName === skillName,
          );

          if (discovered) {
            const clientStates = await this.buildClientStatesForDiscovered(
              discovered,
              clients,
            );

            let content: string | null = null;
            if (discovered.hasSkillMd) {
              try {
                const skillMdPath = path.join(discovered.skillPath, "SKILL.md");
                content = await fsPromises.readFile(skillMdPath, "utf-8");
              } catch {
                // Failed to read content
              }
            }

            const now = Date.now();
            return {
              id: skillId,
              name: discovered.skillName,
              content,
              source: "discovered" as SkillSource,
              originClientId: discovered.sourceClientId,
              clientStates,
              globalSync: false,
              projectId: null,
              createdAt: now,
              updatedAt: now,
            };
          }
        }
        return null;
      }

      // Local skill lookup
      const skillRepo = SkillRepository.getInstance();
      const skill = skillRepo.getById(skillId);

      if (!skill) {
        return null;
      }

      const clientStates = await this.buildClientStates(
        skill.id,
        skill.name,
        clients,
      );
      const content = this.fileManager.readSkillMd(
        this.fileManager.getSkillPath(skill.name),
      );

      return {
        id: skill.id,
        name: skill.name,
        content,
        source: "local" as SkillSource,
        originClientId: undefined,
        clientStates,
        globalSync: skill.enabled,
        projectId: skill.projectId,
        createdAt: skill.createdAt,
        updatedAt: skill.updatedAt,
      };
    } catch (error) {
      return this.handleError("getUnified", error, null);
    }
  }

  /**
   * Update a unified skill's properties
   */
  public async updateUnified(
    id: string,
    updates: UpdateUnifiedSkillInput,
  ): Promise<UnifiedSkill> {
    try {
      const skillRepo = SkillRepository.getInstance();
      const clientAppService = getClientAppService();

      // Discovered skills cannot be updated directly
      if (id.startsWith("discovered:")) {
        throw new Error(
          "Cannot update discovered skills directly. Adopt the skill first.",
        );
      }

      const skill = skillRepo.getById(id);
      if (!skill) {
        throw new Error(`Skill not found: ${id}`);
      }

      const now = Date.now();
      const updateData: Partial<Skill> = { updatedAt: now };

      // Handle name change (rename folder)
      if (updates.name && updates.name !== skill.name) {
        const normalizedName = this.validateAndNormalizeName(updates.name);
        const existingSkill = skillRepo.findByName(normalizedName);
        if (existingSkill && existingSkill.id !== id) {
          throw new Error(`Skill with name "${normalizedName}" already exists`);
        }

        // Rename the skill folder
        const oldPath = this.fileManager.getSkillPath(skill.name);
        const newPath = this.fileManager.getSkillPath(normalizedName);
        await fsPromises.rename(oldPath, newPath);

        // Update symlinks for all clients that have this skill enabled
        const clients = await clientAppService.list();
        const stateRepo = ClientSkillStateRepository.getInstance();

        for (const client of clients) {
          const state = stateRepo.findBySkillAndClient(id, client.id);
          if (state?.state === "enabled" && client.skillsPath) {
            const resolvedPaths = this.resolveClientSkillsPath(
              client.skillsPath,
            );
            for (const targetDir of resolvedPaths) {
              const oldTarget = path.join(targetDir, skill.name);
              const newTarget = path.join(targetDir, normalizedName);
              this.fileManager.removeSymlink(oldTarget);
              this.fileManager.createSymlink(newPath, newTarget);
            }
          }
        }

        updateData.name = normalizedName;
      }

      // Handle content update
      if (updates.content !== undefined) {
        const skillName = updateData.name ?? skill.name;
        const skillPath = this.fileManager.getSkillPath(skillName);
        this.fileManager.writeSkillMd(skillPath, updates.content);
      }

      // Handle globalSync update
      if (updates.globalSync !== undefined) {
        updateData.enabled = updates.globalSync;

        // Sync to all clients if enabled
        if (updates.globalSync) {
          // Will be synced after update completes
        }
      }

      // Handle projectId update
      if (updates.projectId !== undefined) {
        updateData.projectId = updates.projectId;
      }

      // Update database record
      skillRepo.update(id, updateData);

      // If globalSync was enabled, sync to all clients
      if (updates.globalSync === true) {
        await this.syncToAllClients(id);
      }

      // Return updated unified skill
      const clients = await clientAppService.list();
      const updatedSkill = skillRepo.getById(id);
      if (!updatedSkill) {
        throw new Error(`Failed to retrieve updated skill: ${id}`);
      }

      const clientStates = await this.buildClientStates(
        updatedSkill.id,
        updatedSkill.name,
        clients,
      );
      const content = this.fileManager.readSkillMd(
        this.fileManager.getSkillPath(updatedSkill.name),
      );

      return {
        id: updatedSkill.id,
        name: updatedSkill.name,
        content,
        source: "local" as SkillSource,
        originClientId: undefined,
        clientStates,
        globalSync: updatedSkill.enabled,
        projectId: updatedSkill.projectId,
        createdAt: updatedSkill.createdAt,
        updatedAt: updatedSkill.updatedAt,
      };
    } catch (error) {
      return this.handleError("updateUnified", error);
    }
  }

  // ==========================================================================
  // Per-Client Control
  // ==========================================================================

  /**
   * Enable a skill for a specific client by creating symlink
   */
  public async enableForClient(
    skillId: string,
    clientId: string,
  ): Promise<void> {
    try {
      const skillRepo = SkillRepository.getInstance();
      const stateRepo = ClientSkillStateRepository.getInstance();
      const clientAppService = getClientAppService();

      const skill = skillRepo.getById(skillId);
      if (!skill) {
        throw new Error(`Skill not found: ${skillId}`);
      }

      const client = await clientAppService.get(clientId);
      if (!client) {
        throw new Error(`Client not found: ${clientId}`);
      }

      if (!client.skillsPath) {
        throw new Error(`Client ${client.name} has no skills path configured`);
      }

      // Resolve the skills path (handle globs)
      const resolvedPaths = this.resolveClientSkillsPath(client.skillsPath);
      if (resolvedPaths.length === 0) {
        throw new Error(
          `Could not resolve skills path for client ${client.name}`,
        );
      }

      // Create symlink in each resolved path, tracking success
      const skillPath = this.fileManager.getSkillPath(skill.name);
      let allSucceeded = true;
      for (const targetDir of resolvedPaths) {
        const targetPath = path.join(targetDir, skill.name);
        const success = this.fileManager.createSymlink(skillPath, targetPath);
        if (!success) {
          allSucceeded = false;
          console.warn(`Failed to create symlink at ${targetPath}`);
        }
      }

      // Update or create state record with actual symlink status
      const existingState = stateRepo.findBySkillAndClient(skillId, clientId);
      const now = Date.now();
      const symlinkStatus: SymlinkStatus = allSucceeded ? "active" : "broken";

      if (existingState) {
        stateRepo.update(existingState.id, {
          state: "enabled" as ClientSkillStateType,
          symlinkStatus,
          lastSyncAt: now,
          updatedAt: now,
        });
      } else {
        stateRepo.add({
          skillId,
          clientId,
          state: "enabled" as ClientSkillStateType,
          isManaged: true,
          source: "local" as SkillSource,
          symlinkStatus,
          lastSyncAt: now,
          createdAt: now,
          updatedAt: now,
        } as Omit<ClientSkillState, "id">);
      }
    } catch (error) {
      this.handleError("enableForClient", error);
    }
  }

  /**
   * Disable a skill for a specific client by removing symlink
   */
  public async disableForClient(
    skillId: string,
    clientId: string,
  ): Promise<void> {
    try {
      const skillRepo = SkillRepository.getInstance();
      const stateRepo = ClientSkillStateRepository.getInstance();
      const clientAppService = getClientAppService();

      const skill = skillRepo.getById(skillId);
      if (!skill) {
        throw new Error(`Skill not found: ${skillId}`);
      }

      const client = await clientAppService.get(clientId);
      if (!client) {
        throw new Error(`Client not found: ${clientId}`);
      }

      if (!client.skillsPath) {
        // No skills path, nothing to disable
        return;
      }

      // Resolve the skills path (handle globs)
      const resolvedPaths = this.resolveClientSkillsPath(client.skillsPath);

      // Remove symlink from each resolved path
      for (const targetDir of resolvedPaths) {
        const targetPath = path.join(targetDir, skill.name);
        this.fileManager.removeSymlink(targetPath);
      }

      // Update or create state record
      const existingState = stateRepo.findBySkillAndClient(skillId, clientId);
      const now = Date.now();

      if (existingState) {
        stateRepo.update(existingState.id, {
          state: "disabled" as ClientSkillStateType,
          symlinkStatus: "none" as SymlinkStatus,
          lastSyncAt: now,
          updatedAt: now,
        });
      } else {
        stateRepo.add({
          skillId,
          clientId,
          state: "disabled" as ClientSkillStateType,
          isManaged: true,
          source: "local" as SkillSource,
          symlinkStatus: "none" as SymlinkStatus,
          lastSyncAt: now,
          createdAt: now,
          updatedAt: now,
        } as Omit<ClientSkillState, "id">);
      }
    } catch (error) {
      this.handleError("disableForClient", error);
    }
  }

  /**
   * Remove a skill from a client entirely (delete state record)
   */
  public async removeFromClient(
    skillId: string,
    clientId: string,
  ): Promise<void> {
    try {
      const stateRepo = ClientSkillStateRepository.getInstance();

      // First disable to remove symlink
      await this.disableForClient(skillId, clientId);

      // Then delete the state record
      const existingState = stateRepo.findBySkillAndClient(skillId, clientId);
      if (existingState) {
        stateRepo.delete(existingState.id);
      }
    } catch (error) {
      this.handleError("removeFromClient", error);
    }
  }

  // ==========================================================================
  // Discovery & Adoption
  // ==========================================================================

  /**
   * Adopt a discovered skill into router management
   * Copies the skill to router's skills directory and creates symlinks to all clients
   */
  public async adoptSkill(
    skillName: string,
    sourceClientId: string,
  ): Promise<UnifiedSkill> {
    try {
      const skillRepo = SkillRepository.getInstance();
      const clientAppService = getClientAppService();

      // Check if skill already exists locally
      const existingSkill = skillRepo.findByName(skillName);
      if (existingSkill) {
        throw new Error(`Skill "${skillName}" already exists locally`);
      }

      // Find the discovered skill
      const discoveredSkills =
        await clientAppService.discoverSkillsFromClients();
      const discovered = discoveredSkills.find(
        (d) => d.sourceClientId === sourceClientId && d.skillName === skillName,
      );

      if (!discovered) {
        throw new Error(
          `Discovered skill "${skillName}" not found in client ${sourceClientId}`,
        );
      }

      // Validate that the skill path still exists
      if (!fs.existsSync(discovered.skillPath)) {
        throw new Error(
          `Skill "${skillName}" no longer exists at ${discovered.skillPath}. Please refresh and try again.`,
        );
      }

      // Validate skill name
      const normalizedName = this.validateAndNormalizeName(skillName);

      // Copy skill folder to router's skills directory
      this.fileManager.copyFolderToSkills(discovered.skillPath, normalizedName);

      // Create database entry
      const now = Date.now();
      const skill = skillRepo.add({
        name: normalizedName,
        projectId: null,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      } as Omit<Skill, "id">);

      // Create symlinks to all clients
      await this.syncToAllClients(skill.id);

      // Return as UnifiedSkill
      const clients = await clientAppService.list();
      const clientStates = await this.buildClientStates(
        skill.id,
        skill.name,
        clients,
      );
      const content = this.fileManager.readSkillMd(
        this.fileManager.getSkillPath(skill.name),
      );

      return {
        id: skill.id,
        name: skill.name,
        content,
        source: "local" as SkillSource,
        originClientId: undefined,
        clientStates,
        globalSync: skill.enabled,
        projectId: skill.projectId,
        createdAt: skill.createdAt,
        updatedAt: skill.updatedAt,
      };
    } catch (error) {
      return this.handleError("adoptSkill", error);
    }
  }

  // ==========================================================================
  // Bulk Operations
  // ==========================================================================

  /**
   * Sync a skill to all clients by creating symlinks
   */
  public async syncToAllClients(skillId: string): Promise<SkillSyncResult> {
    const result: SkillSyncResult = {
      synced: [],
      skipped: [],
      errors: [],
    };

    try {
      const skillRepo = SkillRepository.getInstance();
      const clientAppService = getClientAppService();

      const skill = skillRepo.getById(skillId);
      if (!skill) {
        throw new Error(`Skill not found: ${skillId}`);
      }

      const clients = await clientAppService.list();

      for (const client of clients) {
        if (!client.skillsPath) {
          result.skipped.push({
            clientId: client.id,
            skillId,
            reason: "No skills path configured",
          });
          continue;
        }

        try {
          await this.enableForClient(skillId, client.id);
          result.synced.push({ clientId: client.id, skillId });
        } catch (error: any) {
          result.errors.push({
            clientId: client.id,
            skillId,
            error: error.message || "Unknown error",
          });
        }
      }
    } catch (error: any) {
      // Top-level error (skill not found, etc.)
      result.errors.push({
        clientId: "all",
        skillId,
        error: error.message || "Unknown error",
      });
    }

    return result;
  }

  /**
   * Enable a skill for all clients
   * Returns sync result with success/error details for each client
   */
  public async enableAll(skillId: string): Promise<SkillSyncResult> {
    const result: SkillSyncResult = {
      synced: [],
      skipped: [],
      errors: [],
    };

    try {
      const skillRepo = SkillRepository.getInstance();

      // Update the skill's enabled flag
      const skill = skillRepo.getById(skillId);
      if (!skill) {
        result.errors.push({
          clientId: "all",
          skillId,
          error: `Skill not found: ${skillId}`,
        });
        return result;
      }

      skillRepo.update(skillId, {
        enabled: true,
        updatedAt: Date.now(),
      });

      // Sync to all clients and return the result
      return await this.syncToAllClients(skillId);
    } catch (error: any) {
      result.errors.push({
        clientId: "all",
        skillId,
        error: error.message || "Unknown error",
      });
      return result;
    }
  }

  /**
   * Disable a skill for all clients
   * Returns sync result with success/error details for each client
   */
  public async disableAll(skillId: string): Promise<SkillSyncResult> {
    const result: SkillSyncResult = {
      synced: [],
      skipped: [],
      errors: [],
    };

    try {
      const skillRepo = SkillRepository.getInstance();
      const clientAppService = getClientAppService();

      // Update the skill's enabled flag
      const skill = skillRepo.getById(skillId);
      if (!skill) {
        result.errors.push({
          clientId: "all",
          skillId,
          error: `Skill not found: ${skillId}`,
        });
        return result;
      }

      skillRepo.update(skillId, {
        enabled: false,
        updatedAt: Date.now(),
      });

      // Disable for all clients, collecting results
      const clients = await clientAppService.list();
      for (const client of clients) {
        if (!client.skillsPath) {
          result.skipped.push({
            clientId: client.id,
            skillId,
            reason: "No skills path configured",
          });
          continue;
        }

        try {
          await this.disableForClient(skillId, client.id);
          result.synced.push({ clientId: client.id, skillId });
        } catch (error: any) {
          result.errors.push({
            clientId: client.id,
            skillId,
            error: error.message || "Unknown error",
          });
        }
      }
    } catch (error: any) {
      result.errors.push({
        clientId: "all",
        skillId,
        error: error.message || "Unknown error",
      });
    }

    return result;
  }

  // ==========================================================================
  // Maintenance
  // ==========================================================================

  /**
   * Verify all symlinks and repair broken ones
   */
  public async verifyAndRepairAll(): Promise<SkillVerifyResult> {
    const result: SkillVerifyResult = {
      healthy: 0,
      repaired: 0,
      failed: [],
    };

    try {
      const skillRepo = SkillRepository.getInstance();
      const stateRepo = ClientSkillStateRepository.getInstance();
      const clientAppService = getClientAppService();

      const skills = skillRepo.getAll();
      const clients = await clientAppService.list();

      for (const skill of skills) {
        if (!skill.enabled) {
          continue;
        }

        const skillPath = this.fileManager.getSkillPath(skill.name);

        for (const client of clients) {
          if (!client.skillsPath) {
            continue;
          }

          const resolvedPaths = this.resolveClientSkillsPath(client.skillsPath);

          for (const targetDir of resolvedPaths) {
            const targetPath = path.join(targetDir, skill.name);
            const status = this.fileManager.verifySymlink(targetPath);

            if (status === "active") {
              result.healthy++;
            } else if (status === "broken" || status === "none") {
              // Attempt repair
              try {
                this.fileManager.createSymlink(skillPath, targetPath);
                result.repaired++;

                // Update state record
                const existingState = stateRepo.findBySkillAndClient(
                  skill.id,
                  client.id,
                );
                if (existingState) {
                  stateRepo.update(existingState.id, {
                    symlinkStatus: "active" as SymlinkStatus,
                    lastSyncAt: Date.now(),
                    updatedAt: Date.now(),
                  });
                }
              } catch (error: any) {
                result.failed.push({
                  clientId: client.id,
                  skillName: skill.name,
                  error: error.message || "Failed to repair symlink",
                });
              }
            }
          }
        }
      }
    } catch (error) {
      this.handleError("verifyAndRepairAll", error);
    }

    return result;
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Build client states for a local skill
   */
  private async buildClientStates(
    skillId: string,
    skillName: string,
    clients: ClientApp[],
  ): Promise<ClientSkillSummary[]> {
    const stateRepo = ClientSkillStateRepository.getInstance();
    const clientStates: ClientSkillSummary[] = [];

    for (const client of clients) {
      // Get state from database
      const dbState = stateRepo.findBySkillAndClient(skillId, client.id);

      // Check actual symlink status
      let symlinkStatus: SymlinkStatus = "none";
      let state: ClientSkillStateType = "not-installed";

      if (client.skillsPath) {
        const resolvedPaths = this.resolveClientSkillsPath(client.skillsPath);
        if (resolvedPaths.length > 0) {
          // Check all resolved paths and aggregate status
          let foundActive = false;
          let foundBroken = false;

          for (const resolvedPath of resolvedPaths) {
            const targetPath = path.join(resolvedPath, skillName);
            const rawStatus = this.fileManager.verifySymlink(targetPath);
            if (rawStatus === "active") {
              foundActive = true;
              break; // Active takes precedence
            } else if (rawStatus === "broken") {
              foundBroken = true;
            }
          }

          if (foundActive) {
            symlinkStatus = "active";
            state = "enabled";
          } else if (foundBroken) {
            symlinkStatus = "broken";
            if (dbState?.state === "disabled") {
              state = "disabled";
            }
          } else if (dbState?.state === "disabled") {
            state = "disabled";
          }
        }
      }

      clientStates.push({
        clientId: client.id,
        clientName: client.name,
        clientIcon: client.icon,
        state,
        isManaged: dbState?.isManaged ?? symlinkStatus === "active",
        symlinkStatus,
      });
    }

    return clientStates;
  }

  /**
   * Build client states for a discovered skill
   */
  private async buildClientStatesForDiscovered(
    discovered: DiscoveredSkill,
    clients: ClientApp[],
  ): Promise<ClientSkillSummary[]> {
    const clientStates: ClientSkillSummary[] = [];

    for (const client of clients) {
      let state: ClientSkillStateType = "not-installed";
      let symlinkStatus: SymlinkStatus = "none";

      // Check if this client is the source of the discovered skill
      if (client.id === discovered.sourceClientId) {
        state = "enabled";
        symlinkStatus = discovered.isSymlink ? "active" : "none";
      } else if (client.skillsPath) {
        // Check if the skill exists in this client's path
        const resolvedPaths = this.resolveClientSkillsPath(client.skillsPath);
        for (const targetDir of resolvedPaths) {
          const targetPath = path.join(targetDir, discovered.skillName);
          const rawStatus = this.fileManager.verifySymlink(targetPath);
          if (rawStatus === "active") {
            state = "enabled";
            symlinkStatus = "active";
            break;
          } else if (rawStatus === "broken") {
            symlinkStatus = "broken";
          }
        }
      }

      clientStates.push({
        clientId: client.id,
        clientName: client.name,
        clientIcon: client.icon,
        state,
        isManaged: false, // Discovered skills are not managed until adopted
        symlinkStatus,
      });
    }

    return clientStates;
  }

  /**
   * Resolve a client's skills path, handling glob patterns
   */
  private resolveClientSkillsPath(skillsPath: string): string[] {
    const expandedPath = expandHomePath(skillsPath);

    if (expandedPath.includes("*")) {
      return resolveGlobPath(expandedPath);
    }

    return [expandedPath];
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
 * Get the UnifiedSkillsService instance
 */
export function getUnifiedSkillsService(): UnifiedSkillsService {
  return UnifiedSkillsService.getInstance();
}
