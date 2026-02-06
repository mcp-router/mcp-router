/**
 * Shared config file type definitions
 * Manages settings shared across workspaces
 */

import { AppSettings } from "./settings-types";
import { Token, TokenServerAccess } from "./token-types";

/**
 * Shared config file structure
 */
export interface SharedConfig {
  /**
   * Application-wide settings
   */
  settings: AppSettings;

  /**
   * MCP Apps (tokens) configuration
   */
  mcpApps: {
    tokens: Token[];
  };

  /**
   * Migration metadata
   */
  _meta?: {
    version: string;
    migratedAt?: string;
    lastModified: string;
  };
}

/**
 * Shared config manager interface
 */
export interface ISharedConfigManager {
  /**
   * Get settings
   */
  getSettings(): AppSettings;

  /**
   * Save settings
   */
  saveSettings(settings: AppSettings): void;

  /**
   * Get list of tokens
   */
  getTokens(): Token[];

  /**
   * Save a token
   */
  saveToken(token: Token): void;

  /**
   * Delete a token
   */
  deleteToken(tokenId: string): void;

  /**
   * Delete tokens associated with a client ID
   */
  deleteClientTokens(clientId: string): void;

  /**
   * Update token server access
   */
  updateTokenServerAccess(
    tokenId: string,
    serverAccess: TokenServerAccess,
  ): void;

  /**
   * Initialize the config file
   */
  initialize(): Promise<void>;

  /**
   * Migrate from existing database
   */
  migrateFromDatabase(workspaceId: string): Promise<void>;

  /**
   * Sync tokens with workspace server list
   * Automatically adds new servers to tokens
   */
  syncTokensWithWorkspaceServers(serverList: string[]): void;
}
