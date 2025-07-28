// CLI package types

export interface ServerClient {
  id: string;
  name: string;
  client: any; // Client from @modelcontextprotocol/sdk
}

export interface ServeServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
}
