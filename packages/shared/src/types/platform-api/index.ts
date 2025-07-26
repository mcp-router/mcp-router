// Platform API types
import {
  MCPServerConfig,
  MCPServer,
  AgentConfig,
  DeployedAgent,
} from "../mcp-types";
import { AppSettings } from "../settings-types";
import { Workspace } from "../workspace";
import { RequestLogEntry } from "../log-types";

// Common types
export type Unsubscribe = () => void;

// Agent API types
export interface CreateAgentInput {
  name: string;
  description: string;
  purpose: string;
  instructions: string;
  mcpServers: MCPServerConfig[];
  autoExecuteTool: boolean;
  toolPermissions?: Record<string, any[]>;
  mcpServerEnabled?: boolean;
}

export interface UpdateAgentInput extends Partial<CreateAgentInput> {
  id: string;
}

export interface DeployTarget {
  type: "local" | "remote";
  config?: any;
}

export interface DeploymentResult {
  success: boolean;
  agentId?: string;
  error?: string;
}

export interface Tool {
  name: string;
  description?: string;
  enabled?: boolean;
  inputSchema?: any;
  serverId?: string;
}

export interface ToolResult {
  content: any;
  isError?: boolean;
}

// Chat message type for platform API
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  toolCalls?: any[];
  toolResults?: ToolResult[];
}

// Agent chat session type
export interface AgentChatSession {
  id: string;
  agentId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  status: "active" | "archived" | "deleted";
}

export interface SessionListOptions {
  agentId?: string;
  status?: "active" | "archived" | "deleted";
  limit?: number;
  offset?: number;
}

export interface SessionListResult {
  sessions: AgentChatSession[];
  total: number;
}

// App API types
export interface PlatformToken {
  token: string;
  expiresAt?: number;
  createdAt: number;
}

export interface PlatformTokenGenerateOptions {
  name?: string;
  expiresIn?: number;
}

export interface TokenResult {
  success: boolean;
  token?: PlatformToken;
  error?: string;
}

// Auth API types
export type AuthProvider = "google" | "github" | "email";

export interface AuthStatus {
  isAuthenticated: boolean;
  user?: any;
  provider?: AuthProvider;
}

// Log API types
export interface LogFilters {
  serverId?: string;
  level?: string;
  startTime?: number;
  endTime?: number;
  search?: string;
}

export interface LogQueryOptions extends LogFilters {
  limit?: number;
  offset?: number;
  sortOrder?: "asc" | "desc";
}

export interface LogQueryResult {
  entries: RequestLogEntry[];
  total: number;
  hasMore: boolean;
}

// Package API types
export type PackageManager = "npm" | "pip" | "cargo";
export type Platform = "darwin" | "win32" | "linux";

export interface ResolveResult {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface UpdateResult {
  success: boolean;
  version?: string;
  error?: string;
}

export interface ManagerStatus {
  installed: boolean;
  version?: string;
  path?: string;
}

export interface InstallResult {
  success: boolean;
  output?: string;
  error?: string;
}

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion?: string;
  releaseNotes?: string;
  downloadUrl?: string;
}

// Server API types
export interface ServerStatus {
  id: string;
  status: "running" | "starting" | "stopping" | "stopped" | "error";
  pid?: number;
  startedAt?: number;
  error?: string;
}

export interface MCPServerStats {
  totalRequests: number;
  activeConnections: number;
  uptime: number;
  memoryUsage?: number;
  cpuUsage?: number;
}

export type CreateServerInput = Omit<MCPServerConfig, "id">;

export interface UpdateServerInput extends Partial<MCPServerConfig> {
  id: string;
}

// Settings API types
export interface OverlayCountResult {
  count: number;
}

// API Interfaces
export interface AgentAPI {
  list(): Promise<AgentConfig[]>;
  get(id: string): Promise<AgentConfig | null>;
  create(input: CreateAgentInput): Promise<AgentConfig>;
  update(input: UpdateAgentInput): Promise<AgentConfig>;
  delete(id: string): Promise<boolean>;
  deploy(agentId: string, target: DeployTarget): Promise<DeploymentResult>;
  listDeployed(): Promise<DeployedAgent[]>;
  getDeployed(id: string): Promise<DeployedAgent | null>;
  deleteDeployed(id: string): Promise<boolean>;
  chat(
    agentId: string,
    message: string,
    sessionId?: string,
  ): Promise<ChatMessage>;
  createSession(agentId: string, title?: string): Promise<AgentChatSession>;
  getSession(sessionId: string): Promise<AgentChatSession | null>;
  updateSession(
    sessionId: string,
    updates: Partial<AgentChatSession>,
  ): Promise<AgentChatSession>;
  listSessions(options?: SessionListOptions): Promise<SessionListResult>;
  deleteSession(sessionId: string): Promise<boolean>;
  executeTool(agentId: string, tool: Tool, args: any): Promise<ToolResult>;
}

export interface AppAPI {
  openExternal(url: string): Promise<void>;
  getVersion(): string;
  getPlatform(): Platform;
  generateToken(options?: PlatformTokenGenerateOptions): Promise<TokenResult>;
  validateToken(token: string): Promise<boolean>;
  revokeToken(token: string): Promise<boolean>;
  listTokens(): Promise<PlatformToken[]>;
  checkForUpdates(): Promise<UpdateInfo>;
  installUpdate(): Promise<void>;
  quitAndInstall(): void;
}

export interface AuthAPI {
  getStatus(): Promise<AuthStatus>;
  login(provider: AuthProvider): Promise<AuthStatus>;
  logout(): Promise<void>;
  onAuthChange(callback: (status: AuthStatus) => void): Unsubscribe;
}

export interface LogAPI {
  query(options?: LogQueryOptions): Promise<LogQueryResult>;
  clear(serverId?: string): Promise<void>;
  export(format: "json" | "csv", filters?: LogFilters): Promise<string>;
  onLogUpdate(callback: (entry: RequestLogEntry) => void): Unsubscribe;
}

export interface PackageAPI {
  resolveCommand(
    manager: PackageManager,
    packageName: string,
    version?: string,
  ): Promise<ResolveResult>;
  updatePackage(packagePath: string): Promise<UpdateResult>;
  checkManagerStatus(manager: PackageManager): Promise<ManagerStatus>;
  installPackageManager(manager: PackageManager): Promise<InstallResult>;
}

export interface ServerAPI {
  list(): Promise<MCPServer[]>;
  get(id: string): Promise<MCPServer | null>;
  create(input: CreateServerInput): Promise<MCPServer>;
  update(input: UpdateServerInput): Promise<MCPServer>;
  delete(id: string): Promise<boolean>;
  start(id: string): Promise<ServerStatus>;
  stop(id: string): Promise<ServerStatus>;
  restart(id: string): Promise<ServerStatus>;
  getStatus(id: string): Promise<ServerStatus>;
  getStats(id: string): Promise<MCPServerStats>;
  getLogs(id: string, limit?: number): Promise<string[]>;
  clearLogs(id: string): Promise<void>;
  onStatusChange(callback: (status: ServerStatus) => void): Unsubscribe;
}

export interface SettingsAPI {
  get(): Promise<AppSettings>;
  update(settings: Partial<AppSettings>): Promise<AppSettings>;
  reset(): Promise<AppSettings>;
  onChange(callback: (settings: AppSettings) => void): Unsubscribe;
  getOverlayCount(): Promise<OverlayCountResult>;
}

export interface WorkspaceAPI {
  list(): Promise<Workspace[]>;
  get(id: string): Promise<Workspace | null>;
  create(name: string, type?: string): Promise<Workspace>;
  update(id: string, updates: Partial<Workspace>): Promise<Workspace>;
  delete(id: string): Promise<boolean>;
  setActive(id: string): Promise<Workspace>;
  getActive(): Promise<Workspace>;
  onChange(callback: (workspace: Workspace) => void): Unsubscribe;
}

// Main Platform API
export interface PlatformAPI {
  agent: AgentAPI;
  app: AppAPI;
  auth: AuthAPI;
  log: LogAPI;
  package: PackageAPI;
  server: ServerAPI;
  settings: SettingsAPI;
  workspace: WorkspaceAPI;
}
