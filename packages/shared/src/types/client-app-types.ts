/**
 * Unified Client App type definitions
 * Combines MCP App configuration and Skills agent paths into a single entity
 */

import type { TokenServerAccess } from "./token-types";

/**
 * Unified Client App entity
 * Each AI client (Claude, Cursor, etc.) has both MCP config and skills paths
 */
export interface ClientApp {
  id: string;
  name: string;
  icon?: string; // SVG, icon key, or Base64

  // Installation & Detection
  installed: boolean; // Auto-detected on filesystem

  // MCP Configuration
  mcpConfigPath: string; // Where to write MCP server config
  mcpConfigured: boolean; // Is MCP Router configured?
  hasOtherMcpServers: boolean; // Other MCP servers in the config?

  // Skills Configuration
  skillsPath: string; // Where to symlink skills
  skillsConfigured: boolean; // Is skills directory set up?

  // Access Control
  serverAccess: TokenServerAccess; // Server ID → allowed
  token?: string; // Auth token for CLI usage

  // Metadata
  isStandard: boolean; // Built-in client definition
  isCustom: boolean; // User-added client
  createdAt: number;
  updatedAt: number;
}

/**
 * Standard client definition (used for built-in clients)
 */
export interface StandardClientDefinition {
  id: string;
  name: string;
  icon?: string;
  // Platform-specific paths
  mcpConfigPath: {
    darwin?: string;
    win32?: string;
    linux?: string;
  };
  skillsPath: {
    darwin?: string;
    win32?: string;
    linux?: string;
  };
  // Detection paths (executable or app bundle)
  detectPaths?: {
    darwin?: string[];
    win32?: string[];
    linux?: string[];
  };
  // Config format
  configFormat: "json" | "yaml" | "toml" | "env-only";
}

/**
 * Input for creating a custom client
 */
export interface CreateClientAppInput {
  name: string;
  mcpConfigPath?: string;
  skillsPath?: string;
  icon?: string;
}

/**
 * Input for updating a client app
 */
export interface UpdateClientAppInput {
  name?: string;
  mcpConfigPath?: string;
  skillsPath?: string;
  icon?: string;
  serverAccess?: TokenServerAccess;
}

/**
 * Result from client app operations
 */
export interface ClientAppResult {
  success: boolean;
  message: string;
  clientApp?: ClientApp;
}

/**
 * Client detection result
 */
export interface ClientDetectionResult {
  id: string;
  installed: boolean;
  mcpConfigExists: boolean;
  skillsPathExists: boolean;
}

/**
 * Interface for ClientAppService
 * Used for type safety in IPC handlers
 */
export interface ClientAppServiceInterface {
  list(): Promise<ClientApp[]>;
  get(id: string): Promise<ClientApp | null>;
  create(input: CreateClientAppInput): Promise<ClientAppResult>;
  update(id: string, updates: UpdateClientAppInput): Promise<ClientAppResult>;
  delete(id: string): Promise<ClientAppResult>;
  detectInstalled(): Promise<ClientDetectionResult[]>;
  configureClient(id: string): Promise<ClientAppResult>;
  updateServerAccess(
    id: string,
    serverAccess: TokenServerAccess,
  ): Promise<ClientAppResult>;
}
