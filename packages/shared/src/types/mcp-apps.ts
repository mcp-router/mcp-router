// MCP Apps related types

// 基本的なMCP設定の構造
export interface McpRouterConfig {
  command: string;
  args: string[];
  env?: {
    MCPR_TOKEN?: string;
  };
}

// 通常アプリの設定構造
export interface StandardAppConfig {
  mcpServers: {
    "mcp-router": McpRouterConfig;
  };
}

// VSCode用の設定構造
export interface VSCodeAppConfig {
  servers: {
    "mcp-router": McpRouterConfig;
  };
}

// Client type definition
export type ClientType = "vscode" | "claude" | "cline" | "windsurf" | "cursor";

// Configuration with client type
export interface ClientConfig {
  type: ClientType;
  path: string;
  content?: any;
}
