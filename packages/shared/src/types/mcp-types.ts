// Input parameter definition for MCP servers
export interface MCPInputParam {
  type?: "string" | "number" | "boolean" | "directory" | "file";
  title?: string;
  description?: string;
  sensitive?: boolean;
  required?: boolean;
  default?: string | number | boolean;
  min?: number;
  max?: number;
}

export interface MCPServerConfig {
  id: string;
  name: string;
  env: Record<string, string>;
  autoStart?: boolean;
  disabled?: boolean;
  description?: string;
  serverType: "local" | "remote" | "remote-streamable";
  command?: string;
  args?: string[];
  remoteUrl?: string;
  bearerToken?: string;

  setupInstructions?: string;
  inputParams?: Record<string, MCPInputParam>;
  verificationStatus?: "verified" | "unverified";
  required?: string[];

  latestVersion?: string;
  version?: string;

  toolPermissions?: MCPServerToolPermissions;
}

export interface MCPTool {
  name: string;
  description?: string;
  enabled?: boolean;
  inputSchema?: any;
}

export interface MCPServerToolPermissions {
  [toolName: string]: boolean;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  inputSchema?: any;
}

export interface MCPServer extends MCPServerConfig {
  id: string;
  status: "running" | "starting" | "stopping" | "stopped" | "error";
  errorMessage?: string; // Error message when status is "error"
  logs?: string[];
  // Properties for the MCP Test Page
  tools?: MCPTool[];
  resources?: MCPResource[];
  prompts?: MCPPrompt[];
}

// Agent type alias for backward compatibility
export type Agent = AgentConfig;

// Agent関連の型定義
export interface AgentConfig {
  id: string;
  name: string;
  purpose: string; // エージェントの目的
  description: string; // エージェントの説明
  instructions: string; // エージェントへの指示（振る舞いの指示）
  mcpServers: MCPServerConfig[];
  toolPermissions?: Record<string, MCPAgentToolPermission[]>; // サーバーIDをキーとしたツール権限の配列
  autoExecuteTool: boolean;
  mcpServerEnabled?: boolean; // MCPサーバとして利用可能にするかどうか
  createdAt?: number;
  updatedAt?: number;
}

// エージェント固有のツール権限
export interface MCPAgentToolPermission {
  toolName: string; // ツール名
  description: string; // ツールの説明
  inputSchema?: any; // ツールのスキーマ情報
  enabled: boolean; // 権限状態
}

// デプロイされたエージェント関連の型定義
export interface DeployedAgent {
  id: string;
  name: string;
  description: string;
  mcpServers: MCPServerConfig[];
  purpose: string;
  instructions: string;
  autoExecuteTool: boolean;
  toolPermissions?: Record<string, MCPAgentToolPermission[]>; // サーバーIDをキーとしたツール権限の配列
  mcpServerEnabled?: boolean; // MCPサーバとして利用可能にするかどうか
  userId?: string; // エージェントの作成者ID
  originalId: string; // インポート元のオリジナルID
  createdAt: number;
  updatedAt: number;
}

export interface APIMCPServer {
  id: string;
  tags: string[];
  displayId: string;
  description: string;
  userId: string;
  iconUrl: string;
  createdAt: number;
  githubUrl: string;
  name: string;
  latestVersion: string;
  updatedAt: number;
  version: string;
}

export interface LocalMCPServer {
  id: string;
  displayId?: string;
  githubUrl: string | null;
  name: string;
  description: string;
  userId: string;
  createdAt: number;
  updatedAt: number;
  command?: string;
  args?: string[];
  envs?: Record<string, string>;
  iconUrl?: string;
  tags?: string[];
  verificationStatus?: "verified" | "unverified";
  inputParams?: Record<string, MCPInputParam>;
  latestVersion?: string;
  version?: string;
  required?: string[];
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

// Base agent information interface
export interface BaseAgentInfo {
  id: string;
  name: string;
  purpose: string;
  description: string;
  instructions: string;
  mcpServers: MCPServerConfig[];
  toolPermissions?: Record<string, MCPAgentToolPermission[]>;
  createdAt: number;
  updatedAt: number;
}

// Agent tool definition
export interface AgentTool {
  name: string;
  description: string;
  inputSchema: any;
}
