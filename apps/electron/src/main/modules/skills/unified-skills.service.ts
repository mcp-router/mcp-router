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

      // Process local skills in parallel (they take precedence)
      const localUnified = await Promise.all(
        localSkills.map(async (skill) => {
          const clientStates = await this.buildClientStates(
            skill.id,
            skill.name,
            clients,
          );
          return this.buildLocalUnifiedSkill(skill, clientStates, null);
        }),
      );

      unifiedSkills.push(...localUnified);
      for (const skill of localSkills) {
        processedNames.add(skill.name.toLowerCase());
      }

      // Filter discovered skills that are not already local
      const skillsDir = this.fileManager.getSkillsDirectory();
      const filteredDiscovered = discoveredSkills.filter((discovered) => {
        const nameLower = discovered.skillName.toLowerCase();
        if (processedNames.has(nameLower)) {
          return false;
        }
        if (
          discovered.isSymlink &&
          discovered.symlinkTarget &&
          discovered.symlinkTarget.startsWith(skillsDir)
        ) {
          return false;
        }
        return true;
      });

      // Process discovered skills in parallel
      const discoveredUnified = await Promise.all(
        filteredDiscovered.map(async (discovered) => {
          const clientStates = await this.buildClientStatesForDiscovered(
            discovered,
            clients,
          );
          const discoveredId = `discovered:${discovered.sourceClientId}:${discovered.skillName}`;
          return this.buildDiscoveredUnifiedSkill(
            discoveredId,
            discovered.skillName,
            discovered.sourceClientId,
            clientStates,
            null,
          );
        }),
      );

      unifiedSkills.push(...discoveredUnified);
      for (const discovered of filteredDiscovered) {
        processedNames.add(discovered.skillName.toLowerCase());
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

            return this.buildDiscoveredUnifiedSkill(
              skillId,
              discovered.skillName,
              discovered.sourceClientId,
              clientStates,
              content,
            );
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

      const [clientStates, content] = await Promise.all([
        this.buildClientStates(skill.id, skill.name, clients),
        this.fileManager.readSkillMdAsync(
          this.fileManager.getSkillPath(skill.name),
        ),
      ]);

      return this.buildLocalUnifiedSkill(skill, clientStates, content);
    } catch (error) {
      return this.handleError("getUnified", error, null);
    }
  }

  /**
   * Update a unified skill's properties
   *
   * Operation order (to prevent race conditions):
   * 1. Validate inputs and collect operations
   * 2. Perform filesystem operations (rename, content write)
   * 3. Update symlinks (non-fatal failures logged for repair via verifyAndRepairAll)
   * 4. Update database last (only after filesystem success)
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

      // Track the effective skill name (may change if renamed)
      let effectiveSkillName = skill.name;
      let newSkillPath: string | null = null;

      // === Phase 1: Validate and collect operations ===

      // Validate name change if requested
      if (updates.name && updates.name !== skill.name) {
        const normalizedName = this.validateAndNormalizeName(updates.name);
        const existingSkill = skillRepo.findByName(normalizedName);
        if (existingSkill && existingSkill.id !== id) {
          throw new Error(`Skill with name "${normalizedName}" already exists`);
        }
        updateData.name = normalizedName;
        effectiveSkillName = normalizedName;
      }

      // Validate globalSync and projectId updates
      if (updates.globalSync !== undefined) {
        updateData.enabled = updates.globalSync;
      }
      if (updates.projectId !== undefined) {
        updateData.projectId = updates.projectId;
      }

      // === Phase 2: Perform filesystem operations ===
      // Note: If any operation fails, we attempt rollback of prior operations

      const oldPath = this.fileManager.getSkillPath(skill.name);
      let renameSucceeded = false;

      // Handle name change (rename folder) - must succeed before DB update
      if (updateData.name && updateData.name !== skill.name) {
        newSkillPath = this.fileManager.getSkillPath(updateData.name);
        await fsPromises.rename(oldPath, newSkillPath);
        renameSucceeded = true;
      }

      // Handle content update
      if (updates.content !== undefined) {
        const skillPath =
          newSkillPath ?? this.fileManager.getSkillPath(effectiveSkillName);
        try {
          this.fileManager.writeSkillMd(skillPath, updates.content);
        } catch (contentError) {
          // Rollback rename if content write fails
          if (renameSucceeded && newSkillPath) {
            try {
              await fsPromises.rename(newSkillPath, oldPath);
            } catch (rollbackError) {
              console.error(
                `Failed to rollback rename after content write failure: ${rollbackError}`,
              );
            }
          }
          throw contentError;
        }
      }

      // === Phase 3: Update symlinks (non-fatal failures) ===

      // Pre-fetch clients once for both Phase 3 and Phase 4
      const clients = await clientAppService.list();

      // Update symlinks for all clients if name changed
      if (updateData.name && updateData.name !== skill.name && newSkillPath) {
        const stateRepo = ClientSkillStateRepository.getInstance();

        for (const client of clients) {
          const state = stateRepo.findBySkillAndClient(id, client.id);
          if (state?.state === "enabled" && client.skillsPath) {
            const resolvedPaths = this.resolveClientSkillsPath(
              client.skillsPath,
            );
            for (const targetDir of resolvedPaths) {
              const oldTarget = path.join(targetDir, skill.name);
              const newTarget = path.join(targetDir, updateData.name);
              // Non-fatal: log failures for repair via verifyAndRepairAll()
              const removeSuccess = this.fileManager.removeSymlink(oldTarget);
              const createSuccess = this.fileManager.createSymlink(
                newSkillPath,
                newTarget,
              );
              if (!removeSuccess || !createSuccess) {
                console.warn(
                  `Symlink update failed for client ${client.id}, skill ${updateData.name}. ` +
                    `Run verifyAndRepairAll() to repair.`,
                );
              }
            }
          }
        }
      }

      // === Phase 4: Update database (only after filesystem success) ===

      skillRepo.update(id, updateData);

      // If globalSync was enabled, sync to all clients
      if (updates.globalSync === true) {
        await this.syncToAllClients(id);
      }

      // Return updated unified skill
      const updatedSkill = skillRepo.getById(id);
      if (!updatedSkill) {
        throw new Error(`Failed to retrieve updated skill: ${id}`);
      }

      const [clientStates, content] = await Promise.all([
        this.buildClientStates(updatedSkill.id, updatedSkill.name, clients),
        this.fileManager.readSkillMdAsync(
          this.fileManager.getSkillPath(updatedSkill.name),
        ),
      ]);

      return this.buildLocalUnifiedSkill(updatedSkill, clientStates, content);
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

      // Validate that the skill path still exists and is a directory
      try {
        const stats = await fsPromises.lstat(discovered.skillPath);

        // Handle symlinks by resolving and checking target
        if (stats.isSymbolicLink()) {
          try {
            const resolvedTarget = await fsPromises.realpath(
              discovered.skillPath,
            );
            const targetStats = await fsPromises.lstat(resolvedTarget);
            if (!targetStats.isDirectory()) {
              throw new Error(
                `Skill "${skillName}" at ${discovered.skillPath} is a symlink pointing to a file, not a directory.`,
              );
            }
          } catch (resolveError: unknown) {
            // Handle broken symlinks (target doesn't exist)
            if (
              resolveError instanceof Error &&
              (resolveError as NodeJS.ErrnoException).code === "ENOENT"
            ) {
              throw new Error(
                `Skill "${skillName}" is a broken symlink at ${discovered.skillPath}. The symlink target no longer exists.`,
              );
            }
            throw resolveError;
          }
        } else if (!stats.isDirectory()) {
          throw new Error(
            `Skill "${skillName}" at ${discovered.skillPath} is not a directory.`,
          );
        }
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          (error as NodeJS.ErrnoException).code === "ENOENT"
        ) {
          throw new Error(
            `Skill "${skillName}" no longer exists at ${discovered.skillPath}. Please refresh and try again.`,
          );
        }
        // Re-throw other errors (including our validation errors)
        throw error;
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
      const [clientStates, content] = await Promise.all([
        this.buildClientStates(skill.id, skill.name, clients),
        this.fileManager.readSkillMdAsync(
          this.fileManager.getSkillPath(skill.name),
        ),
      ]);

      return this.buildLocalUnifiedSkill(skill, clientStates, content);
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
          this.enableForClientWithData(skill, client);
          result.synced.push({ clientId: client.id, skillId });
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);
          result.errors.push({
            clientId: client.id,
            skillId,
            error: message || "Unknown error",
          });
        }
      }
    } catch (error: unknown) {
      // Top-level error (skill not found, etc.)
      const message =
        error instanceof Error ? error.message : String(error);
      result.errors.push({
        clientId: "all",
        skillId,
        error: message || "Unknown error",
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push({
        clientId: "all",
        skillId,
        error: message || "Unknown error",
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
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push({
            clientId: client.id,
            skillId,
            error: message || "Unknown error",
          });
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push({
        clientId: "all",
        skillId,
        error: message || "Unknown error",
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
            const status = await this.fileManager.verifySymlink(targetPath);

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
              } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                result.failed.push({
                  clientId: client.id,
                  skillName: skill.name,
                  error: message || "Failed to repair symlink",
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
   * Build a UnifiedSkill object for a local (router-managed) skill
   */
  private buildLocalUnifiedSkill(
    skill: Skill,
    clientStates: ClientSkillSummary[],
    content: string | null,
  ): UnifiedSkill {
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
  }

  /**
   * Build a UnifiedSkill object for a discovered (not yet adopted) skill
   */
  private buildDiscoveredUnifiedSkill(
    id: string,
    skillName: string,
    sourceClientId: string,
    clientStates: ClientSkillSummary[],
    content: string | null,
  ): UnifiedSkill {
    const now = Date.now();
    return {
      id,
      name: skillName,
      content,
      source: "discovered" as SkillSource,
      originClientId: sourceClientId,
      clientStates,
      globalSync: false,
      projectId: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Enable a skill for a specific client using pre-fetched data.
   * Avoids re-fetching skill and client data (N+1 pattern).
   */
  private enableForClientWithData(skill: Skill, client: ClientApp): void {
    const stateRepo = ClientSkillStateRepository.getInstance();

    if (!client.skillsPath) {
      throw new Error(`Client ${client.name} has no skills path configured`);
    }

    const resolvedPaths = this.resolveClientSkillsPath(client.skillsPath);
    if (resolvedPaths.length === 0) {
      throw new Error(
        `Could not resolve skills path for client ${client.name}`,
      );
    }

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

    const existingState = stateRepo.findBySkillAndClient(skill.id, client.id);
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
        skillId: skill.id,
        clientId: client.id,
        state: "enabled" as ClientSkillStateType,
        isManaged: true,
        source: "local" as SkillSource,
        symlinkStatus,
        lastSyncAt: now,
        createdAt: now,
        updatedAt: now,
      } as Omit<ClientSkillState, "id">);
    }
  }

  /**
   * Build client states for a local skill
   */
  private async buildClientStates(
    skillId: string,
    skillName: string,
    clients: ClientApp[],
  ): Promise<ClientSkillSummary[]> {
    const stateRepo = ClientSkillStateRepository.getInstance();

    const clientStates = await Promise.all(
      clients.map(async (client) => {
        // Get state from database
        const dbState = stateRepo.findBySkillAndClient(skillId, client.id);

        // Check actual symlink status
        let symlinkStatus: SymlinkStatus = "none";
        let state: ClientSkillStateType = "not-installed";

        if (client.skillsPath) {
          const resolvedPaths = this.resolveClientSkillsPath(client.skillsPath);
          if (resolvedPaths.length > 0) {
            // Check all resolved paths in parallel and aggregate status
            const statuses = await Promise.all(
              resolvedPaths.map((resolvedPath) => {
                const targetPath = path.join(resolvedPath, skillName);
                return this.fileManager.verifySymlink(targetPath);
              }),
            );

            const foundActive = statuses.some((s) => s === "active");
            const foundBroken = statuses.some((s) => s === "broken");

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

        return {
          clientId: client.id,
          clientName: client.name,
          clientIcon: client.icon,
          state,
          isManaged: dbState?.isManaged ?? symlinkStatus === "active",
          symlinkStatus,
        } as ClientSkillSummary;
      }),
    );

    return clientStates;
  }

  /**
   * Build client states for a discovered skill
   */
  private async buildClientStatesForDiscovered(
    discovered: DiscoveredSkill,
    clients: ClientApp[],
  ): Promise<ClientSkillSummary[]> {
    const clientStates = await Promise.all(
      clients.map(async (client) => {
        let state: ClientSkillStateType = "not-installed";
        let symlinkStatus: SymlinkStatus = "none";

        // Check if this client is the source of the discovered skill
        if (client.id === discovered.sourceClientId) {
          state = "enabled";
          symlinkStatus = discovered.isSymlink ? "active" : "none";
        } else if (client.skillsPath) {
          // Check if the skill exists in this client's path
          const resolvedPaths = this.resolveClientSkillsPath(client.skillsPath);
          const statuses = await Promise.all(
            resolvedPaths.map((targetDir) => {
              const targetPath = path.join(targetDir, discovered.skillName);
              return this.fileManager.verifySymlink(targetPath);
            }),
          );

          const foundActive = statuses.some((s) => s === "active");
          const foundBroken = statuses.some((s) => s === "broken");

          if (foundActive) {
            state = "enabled";
            symlinkStatus = "active";
          } else if (foundBroken) {
            symlinkStatus = "broken";
          }
        }

        return {
          clientId: client.id,
          clientName: client.name,
          clientIcon: client.icon,
          state,
          isManaged: false, // Discovered skills are not managed until adopted
          symlinkStatus,
        } as ClientSkillSummary;
      }),
    );

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
