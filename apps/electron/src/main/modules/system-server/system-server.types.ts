/**
 * Type definitions for the SystemServer module.
 * These types define the inputs and outputs for router management tools.
 */

/** Input for router_list_servers tool */
export interface ListServersInput {
  /** Filter by server status */
  status?: "running" | "stopped" | "error" | "all";
}

/** Output entry for router_list_servers */
export interface ServerSummary {
  id: string;
  name: string;
  status: "running" | "starting" | "stopping" | "stopped" | "error";
  serverType: "local" | "remote" | "remote-streamable";
  disabled: boolean;
  autoStart: boolean;
  errorMessage?: string;
  description?: string;
  projectId?: string | null;
}

/** Input for router_get_server tool */
export interface GetServerInput {
  /** Server ID or name */
  server: string;
}

/** Input for router_add_server tool */
export interface AddServerInput {
  name: string;
  serverType: "local" | "remote" | "remote-streamable";
  /** Command for local servers (e.g., "npx", "node") */
  command?: string;
  /** Command arguments for local servers */
  args?: string[];
  /** URL for remote or remote-streamable servers */
  remoteUrl?: string;
  /** Bearer token for authenticated remote servers */
  bearerToken?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Description of the server */
  description?: string;
  /** Auto-start on launch */
  autoStart?: boolean;
}

/** Input for router_remove_server tool */
export interface RemoveServerInput {
  /** Server ID or name */
  server: string;
}

/** Input for router_toggle_server tool */
export interface ToggleServerInput {
  /** Server ID or name */
  server: string;
  /** true = enable, false = disable */
  enabled: boolean;
}

/** Input for router_list_tools tool */
export interface ListToolsInput {
  /** Server ID or name (optional — lists all tools if omitted) */
  server?: string;
}

/** Output entry for router_list_tools */
export interface ToolSummary {
  name: string;
  description?: string;
  enabled: boolean;
  serverName: string;
  serverId: string;
}

/** Input for router_start_server tool */
export interface StartServerInput {
  /** Server ID or name */
  server: string;
}

/** Input for router_stop_server tool */
export interface StopServerInput {
  /** Server ID or name */
  server: string;
}

/** Input for router_update_server tool */
export interface UpdateServerInput {
  /** Server ID or name */
  server: string;
  /** New display name */
  name?: string;
  /** New command (local servers) */
  command?: string;
  /** New arguments (local servers) */
  args?: string[];
  /** New environment variables */
  env?: Record<string, string>;
  /** Whether to auto-start on launch */
  autoStart?: boolean;
  /** Whether the server is disabled */
  disabled?: boolean;
}

/** Input for router_get_settings tool (no params) */
export type GetSettingsInput = Record<string, never>;

/** Input for router_update_settings tool */
export interface UpdateSettingsInput {
  /** Whether to enable tool catalog mode */
  toolCatalogEnabled?: boolean;
  /** Whether to prefix tool names with server name */
  prefixToolNames?: boolean;
  /** Whether to load external MCP configs */
  loadExternalMCPConfigs?: boolean;
  /** Whether to enable auto-updates */
  autoUpdateEnabled?: boolean;
  /** Whether to show window on startup */
  showWindowOnStartup?: boolean;
}

/** Input for router_list_workspaces tool (no params) */
export type ListWorkspacesInput = Record<string, never>;

/** Input for router_switch_workspace tool */
export interface SwitchWorkspaceInput {
  /** Workspace ID to switch to */
  workspaceId: string;
}
