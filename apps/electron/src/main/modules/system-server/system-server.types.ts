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
