/**
 * Server management domain API
 */

import type {
  MCPServerConfig,
  MCPServer,
  MCPTool,
} from "../../mcp-types";

export interface ServerStatus {
  type: "stopped" | "starting" | "running" | "stopping" | "error";
  error?: string;
  connectedAt?: Date;
  stats?: ServerStats;
}

interface ServerStats {
  requests: number;
  errors: number;
  uptime: number;
}

export interface CreateServerInput {
  type: "config" | "dxt";
  config?: MCPServerConfig;
  dxtFile?: Uint8Array;
}

export interface ServerAPI {
  list(): Promise<MCPServer[]>;
  listTools(id: string): Promise<MCPTool[]>;
  get(id: string): Promise<MCPServer | null>;
  create(input: CreateServerInput): Promise<MCPServer>;
  update(id: string, updates: Partial<MCPServerConfig>): Promise<MCPServer>;
  updateToolPermissions(
    id: string,
    permissions: Record<string, boolean>,
  ): Promise<MCPServer>;
  delete(id: string): Promise<void>;
  start(id: string): Promise<boolean>;
  stop(id: string): Promise<boolean>;
  getStatus(id: string): Promise<ServerStatus>;
  selectFile(options?: {
    title?: string;
    mode?: "file" | "directory";
    filters?: { name: string; extensions: string[] }[];
  }): Promise<{
    success: boolean;
    path?: string;
    canceled?: boolean;
    error?: string;
  }>;
}
