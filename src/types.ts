export interface MCPServerConfig {
  id: string;
  name: string;
  env: Record<string, string>;
  setupInstructions?: string; // サーバーごとのセットアップ指示
  autoStart?: boolean;
  disabled?: boolean;
  description?: string;
  // Distinguish between local and remote servers
  serverType: 'local' | 'remote' | 'remote-streamable';
  // Fields for local servers
  command?: string;
  args?: string[];
  // Fields for remote servers
  remoteUrl?: string; // For Remote transport
  bearerToken?: string; // Bearer token for authentication
  // Configuration parameters
  inputParams?: Record<string, { default: string; description: string }>;
  // Required configuration parameters (env keys or dynamic arg names)
  required?: string[];
  // Version information
  latestVersion?: string;
  verificationStatus?: 'verified' | 'unverified';
  version?: string;
  // Tool permissions
  toolPermissions?: MCPServerToolPermissions;
}

export interface MCPTool {
  name: string;
  description?: string;
  enabled?: boolean; // Flag to indicate if the tool is enabled for use
  inputSchema?: any; // Tool parameter schema definition
}

export interface MCPServerToolPermissions {
  [toolName: string]: boolean; // Map of tool names to their enabled status
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
  status: 'running' | 'starting' | 'stopping' | 'stopped' | 'error';
  logs?: string[];
  // Properties for the MCP Test Page
  tools?: MCPTool[];
  resources?: MCPResource[];
  prompts?: MCPPrompt[];
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

export interface APIMCPServerVersion {
  id: string;
  version: string;
  command: string;
  args: string[];
  envs: Record<string, string>;
  inputParams: Record<string, { default: string; description: string }>;
  verificationStatus: 'verified' | 'unverified';
  publishedAt: number;
  createdAt: number;
  updatedAt: number;
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
  verificationStatus?: 'verified' | 'unverified';
  inputParams?: Record<string, { default: string; description: string }>;
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
  createdAt?: number;
  updatedAt?: number;
}

// エージェント固有のツール権限
export interface MCPAgentToolPermission {
  toolName: string;    // ツール名
  description: string; // ツールの説明
  inputSchema?: any;   // ツールのスキーマ情報
  enabled: boolean;    // 権限状態
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
  userId?: string; // エージェントの作成者ID
  originalId: string; // インポート元のオリジナルID
  createdAt: number;
  updatedAt: number;
}

// Note: The window.electronAPI interface is defined in global.d.ts
