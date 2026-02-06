import { app } from "electron";
import * as fs from "fs";
import * as path from "path";
import {
  SharedConfig,
  ISharedConfigManager,
  AppSettings,
  Token,
  DEFAULT_APP_SETTINGS,
  TokenServerAccess,
} from "@mcp_router/shared";
import { SqliteManager } from "./database/sqlite-manager";

/**
 * Shared configuration file manager.
 * Manages settings shared across workspaces via JSON file.
 */
export class SharedConfigManager implements ISharedConfigManager {
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
   * Load the configuration file
   */
  private loadConfig(): SharedConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, "utf-8");
        const config = JSON.parse(data);

        // Normalize existing token data (fix invalid data after migration)
        if (config.mcpApps?.tokens) {
          config.mcpApps.tokens = config.mcpApps.tokens.map((token: any) => {
            // Normalize field names
            const normalizedToken: Token = {
              id: token.id,
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

        return config;
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
   * Save the configuration file
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

      // Write to file
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        "utf-8",
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
      ...DEFAULT_APP_SETTINGS,
      ...this.config.settings,
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
    const token = this.config.mcpApps.tokens.find((t) => t.id === tokenId);
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
   * Automatically adds new servers to tokens.
   */
  syncTokensWithWorkspaceServers(serverList: string[]): void {
    let updated = false;

    this.config.mcpApps.tokens.forEach((token) => {
      const map = token.serverAccess || {};
      const initialSize = Object.keys(map).length;
      const nextAccess = { ...map };
      serverList.forEach((id) => {
        if (!(id in nextAccess)) {
          nextAccess[id] = true;
        }
      });
      const nextSize = Object.keys(nextAccess).length;

      // Only update if new server IDs were added
      if (nextSize > initialSize) {
        token.serverAccess = nextAccess;
        updated = true;
        console.log(
          `[SharedConfigManager] Updated token ${token.id} with ${nextSize - initialSize} new server(s)`,
        );
      }
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
