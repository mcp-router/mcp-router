import { safeStorage } from "electron";
import crypto from "crypto";
import argon2 from "argon2";
import type {
  CloudSyncBlobEnvelope,
  CloudSyncState,
  CloudSyncStatus,
  MCPServer,
  MCPServerConfig,
  Workspace,
} from "@mcp_router/shared";
import { getSettingsService } from "@/main/modules/settings/settings.service";
import { getWorkspaceService } from "@/main/modules/workspace/workspace.service";
import { getDecryptedAuthToken } from "@/main/modules/auth/auth.service";
import { fetchWithToken } from "@/main/utils/fetch-utils";
import type { MCPServerManager } from "@/main/modules/mcp-server-manager/mcp-server-manager";
import { McpServerManagerRepository } from "@/main/modules/mcp-server-manager/mcp-server-manager.repository";

const SCHEMA_VERSION = 1;
const NONCE_BYTES = 12;
const SALT_BYTES = 16;
const AUTH_TAG_BYTES = 16;

const KDF_MEMORY_COST = 65536;
const KDF_TIME_COST = 3;
const KDF_PARALLELISM = 1;
const KDF_HASH_LENGTH = 32;

type WorkspaceBundleEntry = Pick<
  Workspace,
  "id" | "name" | "type" | "remoteConfig"
> & {
  mcpServers?: MCPServerConfig[];
};

type WorkspaceBundlePayload = {
  workspaces: WorkspaceBundleEntry[];
};

export class CloudSyncService {
  private static instance: CloudSyncService | null = null;
  private serverManagerProvider?: () => MCPServerManager;
  private syncInProgress = false;
  private pollingTimer: NodeJS.Timeout | null = null;
  private static readonly POLLING_INTERVAL_MS = 600_000; // 10 minutes

  private constructor() {
    // No initialization needed
  }

  public static getInstance(): CloudSyncService {
    if (!CloudSyncService.instance) {
      CloudSyncService.instance = new CloudSyncService();
    }
    return CloudSyncService.instance;
  }

  public initialize(getServerManager: () => MCPServerManager): void {
    this.serverManagerProvider = getServerManager;

    // Start polling if cloud sync is already enabled and user has active subscription
    const state = this.getSyncState();
    const settings = getSettingsService().getSettings();
    const subscriptionStatus = settings.subscriptionStatus;
    const isSubscribed =
      subscriptionStatus === "active" || subscriptionStatus === "trialing";

    if (state.enabled && this.hasPassphrase() && isSubscribed) {
      this.startPolling();
    }
  }

  public async getStatus(): Promise<CloudSyncStatus> {
    const state = this.getSyncState();
    return {
      enabled: state.enabled,
      lastSyncedAt: state.lastSyncedAt,
      lastError: state.lastError,
      hasPassphrase: this.hasPassphrase(),
      encryptionAvailable: safeStorage.isEncryptionAvailable(),
    };
  }

  public async setEnabled(enabled: boolean): Promise<CloudSyncStatus> {
    const next = this.saveSyncState({
      enabled,
      lastError: undefined,
    });

    if (enabled) {
      this.startPolling();
      // Trigger initial sync immediately
      void this.syncNow();
    } else {
      this.stopPolling();
    }

    return {
      enabled: next.enabled,
      lastSyncedAt: next.lastSyncedAt,
      lastError: next.lastError,
      hasPassphrase: this.hasPassphrase(),
      encryptionAvailable: safeStorage.isEncryptionAvailable(),
    };
  }

  public async setPassphrase(passphrase: string): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("Secure storage is not available");
    }

    const encrypted = safeStorage.encryptString(passphrase);
    this.saveSyncState({
      encryptedPassphrase: encrypted.toString("base64"),
      lastError: undefined,
    });

    // Trigger sync if enabled
    const state = this.getSyncState();
    if (state.enabled) {
      void this.syncNow();
    }
  }

  private async syncNow(): Promise<void> {
    const state = this.getSyncState();
    if (!state.enabled) {
      return;
    }

    if (this.syncInProgress) {
      return;
    }

    const token = await getDecryptedAuthToken();
    if (!token) {
      this.saveSyncState({ lastError: "Authentication required" });
      return;
    }

    // Check subscription status
    const settings = getSettingsService().getSettings();
    const subscriptionStatus = settings.subscriptionStatus;
    if (subscriptionStatus !== "active" && subscriptionStatus !== "trialing") {
      this.saveSyncState({ lastError: "Pro subscription required" });
      return;
    }

    const passphrase = this.getPassphrase();
    if (!passphrase) {
      this.saveSyncState({ lastError: "Passphrase is not set" });
      return;
    }

    this.syncInProgress = true;

    try {
      const remote = await this.getBlob(token);
      const remoteUpdatedAt = remote ? Date.parse(remote.updatedAt) : 0;
      const lastSyncedAt = state.lastSyncedAt
        ? Date.parse(state.lastSyncedAt)
        : 0;

      // Pull if remote is newer, otherwise push
      if (remoteUpdatedAt > lastSyncedAt) {
        // Remote is newer → PULL
        const plaintext = await this.decryptBundle(passphrase, remote!);
        await this.applyWorkspaceBundle(plaintext);
        this.saveSyncState({
          lastSyncedAt: remote!.updatedAt,
          lastError: undefined,
        });
      } else {
        // Local might have changes → PUSH
        const plaintext = await this.serializeWorkspaceBundle();
        const encrypted = await this.encryptBundle(passphrase, plaintext);
        const response = await this.putBlob(token, encrypted);
        this.saveSyncState({
          lastSyncedAt: response.updatedAt,
          lastError: undefined,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Cloud sync failed";
      this.saveSyncState({ lastError: message });
    } finally {
      this.syncInProgress = false;
    }
  }

  private getServerManager(): MCPServerManager {
    if (!this.serverManagerProvider) {
      throw new Error("CloudSyncService is not initialized");
    }
    return this.serverManagerProvider();
  }

  private startPolling(): void {
    if (this.pollingTimer) {
      return;
    }

    this.pollingTimer = setInterval(() => {
      void this.syncNow();
    }, CloudSyncService.POLLING_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  private getSyncState(): CloudSyncState {
    const settings = getSettingsService().getSettings();
    const cloudSync = settings.cloudSync;
    const state =
      cloudSync && typeof cloudSync === "object" && "enabled" in cloudSync
        ? cloudSync
        : null;
    return {
      enabled: state?.enabled ?? false,
      lastSyncedAt: state?.lastSyncedAt,
      lastError: state?.lastError,
      encryptedPassphrase: state?.encryptedPassphrase,
    };
  }

  private saveSyncState(updates: Partial<CloudSyncState>): CloudSyncState {
    const settingsService = getSettingsService();
    const settings = settingsService.getSettings();
    const previous = this.getSyncState();
    const next = { ...previous, ...updates };
    settings.cloudSync = next;
    settingsService.saveSettings(settings);
    return next;
  }

  private hasPassphrase(): boolean {
    const state = this.getSyncState();
    return !!state.encryptedPassphrase;
  }

  private getPassphrase(): string | null {
    if (!safeStorage.isEncryptionAvailable()) {
      return null;
    }
    const state = this.getSyncState();
    const encrypted = state.encryptedPassphrase;
    if (!encrypted) {
      return null;
    }

    try {
      return safeStorage.decryptString(Buffer.from(encrypted, "base64"));
    } catch {
      return null;
    }
  }

  private async deriveKey(passphrase: string, salt: Buffer): Promise<Buffer> {
    const key = await argon2.hash(passphrase, {
      type: argon2.argon2id,
      raw: true,
      salt,
      memoryCost: KDF_MEMORY_COST,
      timeCost: KDF_TIME_COST,
      parallelism: KDF_PARALLELISM,
      hashLength: KDF_HASH_LENGTH,
    });
    return Buffer.isBuffer(key) ? key : Buffer.from(key);
  }

  private async encryptBundle(
    passphrase: string,
    plaintext: string,
  ): Promise<CloudSyncBlobEnvelope> {
    const nonce = crypto.randomBytes(NONCE_BYTES);
    const salt = crypto.randomBytes(SALT_BYTES);
    const key = await this.deriveKey(passphrase, salt);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf-8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    const combined = Buffer.concat([encrypted, tag]);

    return {
      nonce: nonce.toString("base64"),
      ciphertext: combined.toString("base64"),
      schemaVersion: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      kdf: "argon2id",
      kdfSalt: salt.toString("base64"),
    };
  }

  private async decryptBundle(
    passphrase: string,
    envelope: CloudSyncBlobEnvelope,
  ): Promise<string> {
    const nonce = Buffer.from(envelope.nonce, "base64");
    const salt = Buffer.from(envelope.kdfSalt, "base64");
    const key = await this.deriveKey(passphrase, salt);
    const data = Buffer.from(envelope.ciphertext, "base64");
    if (data.length <= AUTH_TAG_BYTES) {
      throw new Error("Ciphertext is too short");
    }
    const ciphertext = data.subarray(0, data.length - AUTH_TAG_BYTES);
    const tag = data.subarray(data.length - AUTH_TAG_BYTES);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString("utf-8");
  }

  private async serializeWorkspaceBundle(): Promise<string> {
    const workspaceService = getWorkspaceService();
    const workspaces = await workspaceService.list();
    const entries: WorkspaceBundleEntry[] = [];

    for (const workspace of workspaces) {
      const entry: WorkspaceBundleEntry = {
        id: workspace.id,
        name: workspace.name,
        type: workspace.type,
      };

      if (workspace.type === "remote") {
        entry.remoteConfig = {
          apiUrl: workspace.remoteConfig?.apiUrl ?? "",
        };
      } else {
        const servers = await this.getServersForWorkspace(workspace.id);
        entry.mcpServers = servers.map((server) =>
          this.serializeServer(server),
        );
      }

      entries.push(entry);
    }

    const payload: WorkspaceBundlePayload = { workspaces: entries };
    return JSON.stringify(payload, null, 2);
  }

  private serializeServer(server: MCPServer): MCPServerConfig {
    return {
      id: server.id,
      name: server.name,
      serverType: server.serverType,
      command: server.command,
      args: server.args,
      env: server.env ?? {},
      remoteUrl: server.remoteUrl,
      bearerToken: server.bearerToken,
      autoStart: server.autoStart,
      disabled: server.disabled,
      description: server.description,
      projectId: server.projectId,
      toolPermissions: server.toolPermissions,
    };
  }

  private parseWorkspaceBundle(json: string): WorkspaceBundlePayload {
    const parsed = JSON.parse(json);
    if (!parsed || !Array.isArray(parsed.workspaces)) {
      throw new Error("Invalid workspace bundle format");
    }

    const entries = parsed.workspaces.map((raw: any) => {
      if (!raw || typeof raw !== "object") {
        throw new Error("Invalid workspace entry");
      }
      const id = typeof raw.id === "string" ? raw.id : "";
      const name = typeof raw.name === "string" ? raw.name : "";
      if (!id || !name) {
        throw new Error("Workspace entry missing id or name");
      }
      const type: WorkspaceBundleEntry["type"] =
        raw.type === "remote" ? "remote" : "local";
      const remoteConfig =
        raw.remoteConfig && typeof raw.remoteConfig === "object"
          ? { apiUrl: String(raw.remoteConfig.apiUrl ?? "") }
          : undefined;
      const mcpServers = Array.isArray(raw.mcpServers)
        ? (raw.mcpServers as MCPServerConfig[])
        : [];

      return {
        id,
        name,
        type,
        remoteConfig: type === "remote" ? remoteConfig : undefined,
        mcpServers: type === "local" ? mcpServers : undefined,
      };
    });

    return { workspaces: entries };
  }

  private async getServersForWorkspace(
    workspaceId: string,
  ): Promise<MCPServer[]> {
    const repo = await this.getServerRepositoryForWorkspace(workspaceId);
    return repo.getAllServers();
  }

  private async getServerRepositoryForWorkspace(
    workspaceId: string,
  ): Promise<McpServerManagerRepository> {
    const db = await getWorkspaceService().getWorkspaceDatabase(workspaceId);
    return McpServerManagerRepository.createForDatabase(db);
  }

  private async applyWorkspaceBundle(json: string): Promise<void> {
    const payload = this.parseWorkspaceBundle(json);
    const workspaceService = getWorkspaceService();

    await this.upsertWorkspaces(payload.workspaces);
    await this.deleteMissingWorkspaces(payload.workspaces);

    const activeWorkspace = await workspaceService.getActiveWorkspace();
    const activeWorkspaceId = activeWorkspace?.id ?? null;

    for (const entry of payload.workspaces) {
      if (entry.type !== "local") {
        continue;
      }
      await this.replaceWorkspaceServers(entry, activeWorkspaceId);
    }
  }

  private async upsertWorkspaces(
    entries: WorkspaceBundleEntry[],
  ): Promise<void> {
    const workspaceService = getWorkspaceService();

    for (const entry of entries) {
      const entryType: Workspace["type"] =
        entry.id === "local-default" ? "local" : entry.type;
      const existing = await workspaceService.findById(entry.id);
      const remoteConfig =
        entryType === "remote"
          ? {
              ...(existing?.remoteConfig ?? {}),
              apiUrl:
                entry.remoteConfig?.apiUrl ??
                existing?.remoteConfig?.apiUrl ??
                "",
            }
          : undefined;

      if (!existing) {
        await workspaceService.create({
          id: entry.id,
          name: entry.name,
          type: entryType,
          remoteConfig,
        });
        continue;
      }

      const existingApiUrl = existing.remoteConfig?.apiUrl ?? "";
      const nextApiUrl = remoteConfig?.apiUrl ?? "";
      const remoteConfigChanged =
        entryType === "remote"
          ? existingApiUrl !== nextApiUrl
          : existing.remoteConfig !== undefined;
      const shouldUpdate =
        existing.name !== entry.name ||
        existing.type !== entryType ||
        remoteConfigChanged;

      if (shouldUpdate) {
        const updates: Partial<Workspace> = {
          name: entry.name,
          type: entryType,
          remoteConfig,
        };
        await workspaceService.update(entry.id, updates);
      }
    }
  }

  private async deleteMissingWorkspaces(
    entries: WorkspaceBundleEntry[],
  ): Promise<void> {
    const workspaceService = getWorkspaceService();
    const incomingIds = new Set(entries.map((entry) => entry.id));
    const existingWorkspaces = await workspaceService.list();

    for (const workspace of existingWorkspaces) {
      if (workspace.id === "local-default") {
        continue;
      }
      if (!incomingIds.has(workspace.id)) {
        await workspaceService.delete(workspace.id);
      }
    }
  }

  private async replaceWorkspaceServers(
    entry: WorkspaceBundleEntry,
    activeWorkspaceId: string | null,
  ): Promise<void> {
    const incomingServers = entry.mcpServers ?? [];

    if (entry.id === activeWorkspaceId) {
      // アクティブワークスペースはServerManagerを通じて操作
      // ロールバック用に既存サーバーを保持
      const serverManager = this.getServerManager();
      const existingServers = serverManager.getServers();
      const backupConfigs = existingServers.map((s) => this.serializeServer(s));
      const removedIds: string[] = [];

      try {
        // 既存サーバーを削除
        existingServers.forEach((server) => {
          serverManager.removeServer(server.id);
          removedIds.push(server.id);
        });
        // 新しいサーバーを追加
        incomingServers.forEach((config) => {
          serverManager.addServer(config);
        });
      } catch (error) {
        // エラー時は削除したサーバーを復元
        console.error(
          "[CloudSync] Failed to replace servers, attempting rollback:",
          error,
        );
        backupConfigs.forEach((config) => {
          try {
            if (removedIds.includes(config.id!)) {
              serverManager.addServer(config);
            }
          } catch {
            // ロールバック失敗は無視
          }
        });
        throw error;
      }
      return;
    }

    // 非アクティブワークスペースはリポジトリを直接操作（トランザクション使用）
    const repo = await this.getServerRepositoryForWorkspace(entry.id);
    repo.database.transaction(() => {
      repo.database.exec("DELETE FROM servers");
      incomingServers.forEach((config) => {
        repo.addServer(config);
      });
    });
  }

  private async getBlob(token: string): Promise<CloudSyncBlobEnvelope | null> {
    const response = await fetchWithToken("/vault/servers/blob", {
      method: "GET",
      token,
    });
    if (response.status === 404 || response.status === 204) {
      return null;
    }
    if (!response.ok) {
      throw new Error(
        `Cloud sync failed: ${response.status} ${response.statusText}`,
      );
    }
    return (await response.json()) as CloudSyncBlobEnvelope;
  }

  private async putBlob(
    token: string,
    blob: CloudSyncBlobEnvelope,
  ): Promise<CloudSyncBlobEnvelope> {
    const response = await fetchWithToken("/vault/servers/blob", {
      method: "PUT",
      token,
      body: JSON.stringify({ blob }),
    });
    if (!response.ok) {
      throw new Error(
        `Cloud sync failed: ${response.status} ${response.statusText}`,
      );
    }
    return (await response.json()) as CloudSyncBlobEnvelope;
  }
}

export function getCloudSyncService(): CloudSyncService {
  return CloudSyncService.getInstance();
}
