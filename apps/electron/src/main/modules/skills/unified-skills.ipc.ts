import { ipcMain } from "electron";
import type {
  ClientSkillState,
  ClientSkillStateType,
  SkillSyncResult,
  SkillVerifyResult,
  UnifiedSkill,
  UpdateUnifiedSkillInput,
} from "@mcp_router/shared";

/**
 * Interface for UnifiedSkillsService matching the actual implementation
 */
interface UnifiedSkillsService {
  listUnified(): Promise<UnifiedSkill[]>;
  getUnified(id: string): Promise<UnifiedSkill | null>;
  updateUnified(
    id: string,
    updates: UpdateUnifiedSkillInput,
  ): Promise<UnifiedSkill>;
  enableForClient(skillId: string, clientId: string): Promise<void>;
  disableForClient(skillId: string, clientId: string): Promise<void>;
  removeFromClient(skillId: string, clientId: string): Promise<void>;
  adoptSkill(skillName: string, sourceClientId: string): Promise<UnifiedSkill>;
  syncToAllClients(skillId: string): Promise<SkillSyncResult>;
  verifyAndRepairAll(): Promise<SkillVerifyResult>;
  enableAll(skillId: string): Promise<SkillSyncResult>;
  disableAll(skillId: string): Promise<SkillSyncResult>;
  setClientState(
    skillId: string,
    clientId: string,
    state: ClientSkillStateType,
  ): Promise<ClientSkillState>;
}

let unifiedSkillsService: UnifiedSkillsService | null = null;

/**
 * Get or create the UnifiedSkillsService instance
 * TODO: Replace with actual service implementation when Task #30 is complete
 */
function getUnifiedSkillsService(): UnifiedSkillsService {
  if (!unifiedSkillsService) {
    throw new Error(
      "UnifiedSkillsService not initialized. Service implementation pending (Task #30).",
    );
  }
  return unifiedSkillsService;
}

/**
 * Set the UnifiedSkillsService instance
 * Called during application initialization
 */
export function setUnifiedSkillsService(service: UnifiedSkillsService): void {
  unifiedSkillsService = service;
}

/**
 * Setup IPC handlers for unified skills management
 */
export function setupUnifiedSkillsHandlers(): void {
  // List all unified skills with client states
  ipcMain.handle("skill:list-unified", async () => {
    const service = getUnifiedSkillsService();
    return service.listUnified();
  });

  // Get a single unified skill by ID
  ipcMain.handle("skill:get-unified", async (_evt, id: string) => {
    if (!id) throw new Error("Missing skill id");
    const service = getUnifiedSkillsService();
    return service.getUnified(id);
  });

  // Update a unified skill
  ipcMain.handle(
    "skill:update-unified",
    async (_evt, id: string, updates: UpdateUnifiedSkillInput) => {
      if (!id) throw new Error("Missing skill id");
      const service = getUnifiedSkillsService();
      return service.updateUnified(id, updates);
    },
  );

  // Enable a skill for a specific client
  ipcMain.handle(
    "skill:enable-for-client",
    async (_evt, skillId: string, clientId: string) => {
      if (!skillId) throw new Error("Missing skill id");
      if (!clientId) throw new Error("Missing client id");
      const service = getUnifiedSkillsService();
      return service.enableForClient(skillId, clientId);
    },
  );

  // Disable a skill for a specific client
  ipcMain.handle(
    "skill:disable-for-client",
    async (_evt, skillId: string, clientId: string) => {
      if (!skillId) throw new Error("Missing skill id");
      if (!clientId) throw new Error("Missing client id");
      const service = getUnifiedSkillsService();
      return service.disableForClient(skillId, clientId);
    },
  );

  // Remove a skill from a specific client
  ipcMain.handle(
    "skill:remove-from-client",
    async (_evt, skillId: string, clientId: string) => {
      if (!skillId) throw new Error("Missing skill id");
      if (!clientId) throw new Error("Missing client id");
      const service = getUnifiedSkillsService();
      return service.removeFromClient(skillId, clientId);
    },
  );

  // Adopt a discovered skill into router management
  ipcMain.handle(
    "skill:adopt",
    async (_evt, skillName: string, sourceClientId: string) => {
      if (!skillName) throw new Error("Missing skill name");
      if (!sourceClientId) throw new Error("Missing source client id");
      const service = getUnifiedSkillsService();
      return service.adoptSkill(skillName, sourceClientId);
    },
  );

  // Sync a skill to all enabled clients
  ipcMain.handle("skill:sync-to-all", async (_evt, skillId: string) => {
    if (!skillId) throw new Error("Missing skill id");
    const service = getUnifiedSkillsService();
    return service.syncToAllClients(skillId);
  });

  // Verify and repair all skill symlinks
  ipcMain.handle("skill:verify-and-repair", async () => {
    const service = getUnifiedSkillsService();
    return service.verifyAndRepairAll();
  });

  // Enable a skill for all clients
  ipcMain.handle("skill:enable-all", async (_event, skillId: string) => {
    const service = getUnifiedSkillsService();
    return service.enableAll(skillId);
  });

  // Disable a skill for all clients
  ipcMain.handle("skill:disable-all", async (_event, skillId: string) => {
    const service = getUnifiedSkillsService();
    return service.disableAll(skillId);
  });

  // Set client state for a skill
  ipcMain.handle(
    "skill:set-client-state",
    async (
      _evt,
      input: { skillId: string; clientId: string; state: string },
    ) => {
      if (!input.skillId) throw new Error("Missing skill id");
      if (!input.clientId) throw new Error("Missing client id");
      if (!input.state) throw new Error("Missing state");
      const service = getUnifiedSkillsService();
      return service.setClientState(
        input.skillId,
        input.clientId,
        input.state as ClientSkillStateType,
      );
    },
  );
}
