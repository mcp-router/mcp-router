// CLI package types

export interface ServerClient {
  id: string;
  name: string;
  client: any; // Client from @modelcontextprotocol/sdk
}

export interface CLIServerConfig {
  type: "stdio" | "sse";
  name: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  apiKey?: string;
}

export interface ServeServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
}

export interface ConnectApiTestResponse {
  success: boolean;
  message: string;
  timestamp: string;
  aggregatorEnabled: boolean;
}
