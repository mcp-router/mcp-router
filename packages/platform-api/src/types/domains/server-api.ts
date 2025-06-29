/**
 * Server management domain API
 */

import { MCPServerConfig } from "@mcp-router/shared";

export interface Server {
  id: string;
  name: string;
  config: MCPServerConfig;
  status?: ServerStatus;
}

export interface ServerStatus {
  type: "stopped" | "starting" | "running" | "stopping" | "error";
  error?: string;
  connectedAt?: Date;
  stats?: ServerStats;
}

export interface ServerStats {
  requests: number;
  errors: number;
  uptime: number;
}

export interface CreateServerInput {
  name: string;
  config: MCPServerConfig;
}

export interface UpdateServerInput {
  name?: string;
  config?: Partial<MCPServerConfig>;
}

export interface ServerAPI {
  list(): Promise<Server[]>;
  get(id: string): Promise<Server | null>;
  create(input: CreateServerInput): Promise<Server>;
  update(id: string, updates: UpdateServerInput): Promise<Server>;
  delete(id: string): Promise<void>;
  start(id: string): Promise<boolean>;
  stop(id: string): Promise<boolean>;
  getStatus(id: string): Promise<ServerStatus>;
  fetchFromIndex(
    page?: number,
    limit?: number,
    search?: string,
    isVerified?: boolean,
  ): Promise<any>;
  fetchVersionDetails(displayId: string, version: string): Promise<any>;
}
