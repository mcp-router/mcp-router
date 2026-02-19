import { app } from "electron";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import {
  SharedConfig,
  ISharedConfigManager,
  AppSettings,
  Token,
  DEFAULT_APP_SETTINGS,
  TokenServerAccess,
} from "@mcp_router/shared";
import { SqliteManager } from "./database/sqlite-manager";
import {
  encryptString,
  decryptString,
  isEncrypted,
  isEncryptionAvailable,
} from "@/main/utils/safe-storage";

/**
 * Shared configuration file manager.
 * Manages settings shared across workspaces via JSON file.
 */
class SharedConfigManager implements ISharedConfigManager {
  private static instance: SharedConfigManager | null = null;
  private configPath: string;
  private config: SharedConfig;
  private readonly configFileName = "shared-config.json";

  private constructor() {
    this.configPath = path.join(app.getPath("userData"), this.configFileName);
    this.config = this.loadConfig();
  }

  /**
   * Create a deep copy of a token
   */
  private cloneToken(token: Token): Token {
    return {
      ...token,
      serverAccess: { ...(token.serverAccess || {}) } as TokenServerAccess,
    };
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): SharedConfigManager {
    if (!SharedConfigManager.instance) {
      SharedConfigManager.instance = new SharedConfigManager();
    }
    return SharedConfigManager.instance;
  }

  /**
   * Reset the instance (for testing)
   */
  public static resetInstance(): void {
    SharedConfigManager.instance = null;
  }

  /**
   * Load the configuration file.
   * Decrypts sensitive fields (authToken, token IDs) after reading from disk.
   * If plaintext tokens are found and encryption is available, they will be
   * encrypted on the next save (transparent migration).
   */
  private loadConfig(): SharedConfig {
    let needsResave = false;
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, "utf-8");
        const config = JSON.parse(data);

        // Decrypt authToken if present
        if (config.settings?.authToken) {
          if (isEncrypted(config.settings.authToken)) {
            config.settings.authToken = decryptString(
              config.settings.authToken,
            );
          } else if (config.settings.authToken && isEncryptionAvailable()) {
            // Plaintext token found with encryption available - migrate on next save
            needsResave = true;
          }
        }

        // Normalize existing token data (fix invalid data after migration)
        if (config.mcpApps?.tokens) {
          config.mcpApps.tokens = config.mcpApps.tokens.map((token: any) => {
            // Decrypt token ID if encrypted
            let tokenId = token.id;
            if (isEncrypted(tokenId)) {
              tokenId = decryptString(tokenId);
            } else if (tokenId && isEncryptionAvailable()) {
              // Plaintext token ID found - migrate on next save
              needsResave = true;
            }

            // Normalize field names
            const normalizedToken: Token = {
              id: tokenId,
              clientId: token.clientId || token.client_id,
              issuedAt: token.issuedAt || token.issued_at,
              serverAccess: {},
            };

            // Convert server access info to map
            const serverAccessValue = token.serverAccess || {};
            normalizedToken.serverAccess = {
              ...(serverAccessValue as TokenServerAccess),
            };

            return normalizedToken;
          });
        }

        // Store the config (in-memory values are always plaintext)
        const result = config as SharedConfig;

        // If we found plaintext secrets and encryption is available, re-save to encrypt them
        if (needsResave) {
          this.config = result;
          this.saveConfig();
          console.log(
            "[SharedConfigManager] Migrated plaintext tokens to encrypted storage",
          );
        }

        return result;
      }
    } catch (error) {
      console.error("[SharedConfigManager] Failed to load config:", error);
    }

    // Return default settings
    return {
      settings: { ...DEFAULT_APP_SETTINGS },
      mcpApps: {
        tokens: [],
      },
      _meta: {
        version: "1.0.0",
        lastModified: new Date().toISOString(),
      },
    };
  }

  /**
   * Save the configuration file.
   * Encrypts sensitive fields (authToken, token IDs) before writing to disk.
   * The in-memory config always retains plaintext values.
   */
  private saveConfig(): void {
    try {
      // Update meta information
      if (!this.config._meta) {
        this.config._meta = {
          version: "1.0.0",
          lastModified: new Date().toISOString(),
        };
      } else {
        this.config._meta.lastModified = new Date().toISOString();
      }

      // Create a deep copy for disk serialization with encrypted sensitive fields
      const configForDisk = JSON.parse(JSON.stringify(this.config));

      // Encrypt authToken before writing
      if (configForDisk.settings?.authToken) {
        configForDisk.settings.authToken = encryptString(
          configForDisk.settings.authToken,
        );
      }

      // Encrypt token IDs before writing
      if (configForDisk.mcpApps?.tokens) {
        configForDisk.mcpApps.tokens = configForDisk.mcpApps.tokens.map(
          (token: Token) => ({
            ...token,
            id: encryptString(token.id),
          }),
        );
      }

      // Write to file with restricted permissions (owner read/write only)
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(configForDisk, null, 2),
        { encoding: "utf-8", mode: 0o600 },
      );
    } catch (error) {
      console.error("[SharedConfigManager] Failed to save config:", error);
      throw error;
    }
  }

  /**
   * Initialize
   */
  async initialize(): Promise<void> {
    // If config file doesn't exist, migrate from existing database
    if (!fs.existsSync(this.configPath)) {
      await this.migrateFromDatabase("local-default");
    }
  }

  /**
   * Migrate from an existing database
   */
  async migrateFromDatabase(workspaceId: string): Promise<void> {
    try {
      // Build workspace database path
      const dbPath =
        workspaceId === "local-default"
          ? path.join(app.getPath("userData"), "mcprouter.db")
          : path.join(
              app.getPath("userData"),
              "workspaces",
              workspaceId,
              "database.db",
            );

      if (!fs.existsSync(dbPath)) {
        return;
      }

      const db = new SqliteManager(dbPath);

      // Migrate data from settings table

      const settingsRows = db.all<{ key: string; value: string }>(
        "SELECT key, value FROM settings",
      );

      const settings: AppSettings = { ...DEFAULT_APP_SETTINGS };
      settingsRows.forEach((row) => {
        const key = row.key as keyof AppSettings;
        if (key in settings) {
          try {
            settings[key] = JSON.parse(row.value);
          } catch {
            settings[key] = row.value as any;
          }
        }
      });
      this.config.settings = settings;

      // Migrate data from tokens table

      const tokenRows = db.all<any>("SELECT * FROM tokens");

      // Convert field names to correct format
      this.config.mcpApps.tokens = tokenRows.map((row) => {
        const token: Token = {
          id: row.id,
          clientId: row.client_id || row.clientId,
          issuedAt: row.issued_at || row.issuedAt,
          serverAccess: {},
        };

        // Convert server access info to map
        if (row.serverAccess) {
          token.serverAccess = { ...(row.serverAccess as TokenServerAccess) };
        }

        return token;
      });

      // Record meta information
      this.config._meta = {
        version: "1.0.0",
        migratedAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
      };

      // Save config
      this.saveConfig();

      db.close();
      console.log("[SharedConfigManager] Migration completed successfully");
    } catch (error) {
      console.error("[SharedConfigManager] Migration failed:", error);
      throw error;
    }
  }

  /**
   * Get application settings
   */
  getSettings(): AppSettings {
    return {
      ...DEFAULT_APP_SETTINGS,
      ...this.config.settings,
    };
  }

  /**
   * Save application settings
   */
  saveSettings(settings: AppSettings): void {
    this.config.settings = {
      ...this.getSettings(),
      ...settings,
    };
    this.saveConfig();
  }

  /**
   * Get token list
   */
  getTokens(): Token[] {
    return this.config.mcpApps.tokens.map((token) => this.cloneToken(token));
  }

  /**
   * Get a token by ID
   */
  getToken(tokenId: string): Token | undefined {
    const inputHash = crypto.createHash("sha256").update(tokenId).digest();
    const token = this.config.mcpApps.tokens.find((t) => {
      try {
        const storedHash = crypto.createHash("sha256").update(t.id).digest();
        return crypto.timingSafeEqual(inputHash, storedHash);
      } catch {
        return false;
      }
    });
    return token ? this.cloneToken(token) : undefined;
  }

  /**
   * Save a token
   */
  saveToken(token: Token): void {
    const normalizedToken: Token = {
      ...token,
      serverAccess: token.serverAccess || {},
    };

    const index = this.config.mcpApps.tokens.findIndex(
      (t) => t.id === token.id,
    );
    if (index >= 0) {
      this.config.mcpApps.tokens[index] = normalizedToken;
    } else {
      this.config.mcpApps.tokens.push(normalizedToken);
    }
    this.saveConfig();
  }

  /**
   * Delete a token
   */
  deleteToken(tokenId: string): void {
    this.config.mcpApps.tokens = this.config.mcpApps.tokens.filter(
      (t) => t.id !== tokenId,
    );
    this.saveConfig();
  }

  /**
   * Delete tokens associated with a client ID
   */
  deleteClientTokens(clientId: string): void {
    this.config.mcpApps.tokens = this.config.mcpApps.tokens.filter(
      (t) => t.clientId !== clientId,
    );
    this.saveConfig();
  }

  /**
   * Get tokens by client ID
   */
  getTokensByClientId(clientId: string): Token[] {
    return this.config.mcpApps.tokens
      .filter((t) => t.clientId === clientId)
      .map((token) => this.cloneToken(token));
  }

  /**
   * Update server access list for a token
   */
  updateTokenServerAccess(
    tokenId: string,
    serverAccess: TokenServerAccess,
  ): void {
    const token = this.config.mcpApps.tokens.find((t) => t.id === tokenId);
    if (token) {
      token.serverAccess = serverAccess || {};
      this.saveConfig();
    }
  }

  /**
   * Sync tokens with workspace server list.
   * Removes access entries for servers that no longer exist in the workspace.
   * New servers must be explicitly granted per token.
   */
  syncTokensWithWorkspaceServers(serverList: string[]): void {
    let updated = false;
    const existingServerIds = new Set(serverList);

    this.config.mcpApps.tokens.forEach((token) => {
      const map = token.serverAccess || {};
      const nextAccess: TokenServerAccess = {};

      for (const [serverId, hasAccess] of Object.entries(map)) {
        if (existingServerIds.has(serverId)) {
          nextAccess[serverId] = hasAccess;
        } else {
          updated = true;
          console.log(
            `[SharedConfigManager] Removed stale server access "${serverId}" from token ${token.id}`,
          );
        }
      }

      token.serverAccess = nextAccess;
    });

    // Save if changes were made
    if (updated) {
      this.saveConfig();
      console.log(
        "[SharedConfigManager] Tokens synchronized with workspace servers",
      );
    }
  }
}

/**
 * Get the singleton instance of SharedConfigManager
 */
export function getSharedConfigManager(): SharedConfigManager {
  return SharedConfigManager.getInstance();
}
