/**
 * Platform API interface that abstracts the underlying platform implementation
 * This allows the frontend stores to work with both Electron and Web platforms
 */

import {
  TokenGenerateOptions,
  TokenScope,
  AppSettings,
  Agent,
  AgentConfig,
  DeployedAgent,
  MCPServerConfig,
  McpAppsManagerResult,
  McpApp,
  ServerPackageUpdates,
} from "@mcp-router/shared";

// Platform API interface that matches the current electronAPI
export interface PlatformAPI {
  // Authentication
  login: (idp?: string) => Promise<boolean>;
  logout: () => Promise<boolean>;
  getAuthStatus: (forceRefresh?: boolean) => Promise<{
    authenticated: boolean;
    userId?: string;
    user?: any;
    token?: string;
  }>;
  handleAuthToken: (token: string, state?: string) => Promise<boolean>;
  onAuthStatusChanged: (
    callback: (status: {
      loggedIn: boolean;
      userId?: string;
      user?: any;
    }) => void,
  ) => () => void;

  // MCP Server Management
  listMcpServers: () => Promise<any>;
  startMcpServer: (id: string) => Promise<boolean>;
  stopMcpServer: (id: string) => Promise<boolean>;
  addMcpServer: (serverConfig: MCPServerConfig) => Promise<any>;
  removeMcpServer: (id: string) => Promise<any>;
  updateMcpServerConfig: (id: string, config: any) => Promise<any>;
  fetchMcpServersFromIndex: (
    page?: number,
    limit?: number,
    search?: string,
    isVerified?: boolean,
  ) => Promise<any>;
  fetchMcpServerVersionDetails: (
    displayId: string,
    version: string,
  ) => Promise<any>;

  // Logging
  getRequestLogs: (options?: {
    clientId?: string;
    serverId?: string;
    requestType?: string;
    startDate?: Date;
    endDate?: Date;
    responseStatus?: "success" | "error";
    offset?: number;
    limit?: number;
  }) => Promise<{
    logs: any[];
    total: number;
  }>;


  // Settings
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<boolean>;
  incrementPackageManagerOverlayCount: () => Promise<{
    success: boolean;
    count: number;
  }>;

  // MCP Apps
  listMcpApps: () => Promise<McpApp[]>;
  addMcpAppConfig: (appName: string) => Promise<McpAppsManagerResult>;
  deleteMcpApp: (appName: string) => Promise<boolean>;
  updateAppServerAccess: (
    appName: string,
    serverIds: string[],
  ) => Promise<McpAppsManagerResult>;
  unifyAppConfig: (appName: string) => Promise<McpAppsManagerResult>;

  // Command utilities
  checkCommandExists: (command: string) => Promise<boolean>;

  // Agent Management
  listAgents: () => Promise<Agent[]>;
  getAgent: (id: string) => Promise<Agent | undefined>;
  createAgent: (agentConfig: Omit<AgentConfig, "id">) => Promise<Agent>;
  updateAgent: (
    id: string,
    config: Partial<AgentConfig>,
  ) => Promise<Agent | undefined>;
  deleteAgent: (id: string) => Promise<boolean>;
  shareAgent: (id: string) => Promise<string>;
  importAgent: (shareCode: string) => Promise<DeployedAgent | undefined>;

  // Agent Deployment
  deployAgent: (id: string) => Promise<DeployedAgent | undefined>;
  getDeployedAgents: () => Promise<DeployedAgent[] | undefined>;
  updateDeployedAgent: (
    id: string,
    config: any,
  ) => Promise<DeployedAgent | undefined>;
  deleteDeployedAgent: (id: string) => Promise<boolean>;

  // Package Management
  resolvePackageVersionsInArgs: (
    argsString: string,
    packageManager: "pnpm" | "uvx",
  ) => Promise<{ success: boolean; resolvedArgs?: string; error?: string }>;
  checkMcpServerPackageUpdates: (
    args: string[],
    packageManager: "pnpm" | "uvx",
  ) => Promise<{
    success: boolean;
    updates?: ServerPackageUpdates;
  }>;

  // Agent Tools
  getAgentMCPServerTools: (
    agentId: string,
    serverId: string,
    isDev?: boolean,
  ) => Promise<{ success: boolean; tools: any[]; error?: string }>;
  executeAgentTool: (
    agentId: string,
    toolName: string,
    args: Record<string, any>,
  ) => Promise<{ success: boolean; result?: any; error?: string }>;

  // Background Chat
  startBackgroundChat: (
    sessionId: string | undefined,
    agentId: string,
    query: string,
  ) => Promise<{ success: boolean; error?: string }>;
  stopBackgroundChat: (
    agentId: string,
  ) => Promise<{ success: boolean; error?: string }>;
  onBackgroundChatStart: (callback: (data: any) => void) => () => void;
  onBackgroundChatStop: (callback: (data: any) => void) => () => void;

  // Session Management
  fetchSessionMessages: (sessionId: string) => Promise<any[]>;
  getSessions: (
    agentId: string,
    options?: any,
  ) => Promise<{ sessions: any[]; hasMore: boolean; nextCursor?: string }>;
  createSession: (agentId: string, initialMessages?: any[]) => Promise<any>;
  updateSessionMessages: (sessionId: string, messages: any[]) => Promise<any>;
  deleteSession: (sessionId: string) => Promise<boolean>;

  // Chat Stream Communication
  sendChatStreamStart: (
    streamData: any,
  ) => Promise<{ success: boolean; error?: string }>;
  sendChatStreamChunk: (
    chunkData: any,
  ) => Promise<{ success: boolean; error?: string }>;
  sendChatStreamEnd: (
    endData: any,
  ) => Promise<{ success: boolean; error?: string }>;
  sendChatStreamError: (
    errorData: any,
  ) => Promise<{ success: boolean; error?: string }>;

  // Chat Stream Listeners
  onChatStreamStart: (callback: (data: any) => void) => () => void;
  onChatStreamChunk: (callback: (data: any) => void) => () => void;
  onChatStreamEnd: (callback: (data: any) => void) => () => void;
  onChatStreamError: (callback: (data: any) => void) => () => void;

  // Token Management
  updateTokenScopes: (
    tokenId: string,
    scopes: TokenScope[],
  ) => Promise<McpAppsManagerResult>;

  // Feedback
  submitFeedback: (feedback: string) => Promise<boolean>;

  // Updates
  checkForUpdates: () => Promise<{ updateAvailable: boolean }>;
  installUpdate: () => Promise<boolean>;
  onUpdateAvailable: (callback: (available: boolean) => void) => () => void;

  // Protocol handling
  onProtocolUrl: (callback: (url: string) => void) => () => void;

  // Package Manager utilities
  checkPackageManagers: () => Promise<{
    node: boolean;
    pnpm: boolean;
    uv: boolean;
  }>;
  installPackageManagers: () => Promise<{
    success: boolean;
    installed: { node: boolean; pnpm: boolean; uv: boolean };
    errors?: { node?: string; pnpm?: string; uv?: string };
  }>;
  restartApp: () => Promise<boolean>;
}
