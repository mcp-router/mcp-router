/**
 * Platform API abstraction layer
 * 
 * This module provides a unified API that can work in both Electron and web environments.
 * It abstracts away the direct use of window.electronAPI to enable future web platform support.
 */

import { TokenGenerateOptions, TokenScope } from "@mcp-router/shared";
import { AppSettings } from "@mcp-router/shared";
import { Agent, AgentConfig, DeployedAgent, MCPServerConfig } from "@mcp-router/shared";
import { McpAppsManagerResult, McpApp } from "@/main/services/mcp-apps-service";
import { ServerPackageUpdates } from "@/lib/utils/backend/package-version-resolver";

// Platform detection
const isElectron = () => {
  return typeof window !== 'undefined' && window.electronAPI;
};

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
  onAuthStatusChanged: (callback: (status: {
    loggedIn: boolean;
    userId?: string;
    user?: any;
  }) => void) => () => void;

  // MCP Server Management
  listMcpServers: () => Promise<any>;
  startMcpServer: (id: string) => Promise<boolean>;
  stopMcpServer: (id: string) => Promise<boolean>;
  addMcpServer: (serverConfig: MCPServerConfig) => Promise<any>;
  removeMcpServer: (id: string) => Promise<any>;
  getMcpServerStatus: (id: string) => Promise<any>;
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
  getAvailableRequestTypes: () => Promise<string[]>;
  getAvailableClientIds: () => Promise<string[]>;
  getClientStats: () => Promise<any[]>;
  getServerStats: () => Promise<any[]>;
  getRequestTypeStats: () => Promise<any[]>;

  // General server methods
  getServers: () => Promise<any>;

  // Invitation & Activation
  fetchInvitation: () => Promise<any>;
  checkActivation: () => Promise<boolean>;
  submitInvitationCode: (code: string) => Promise<boolean>;

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
  completeAgentSetup: (
    id: string,
    completed: boolean,
    updatedServers?: any[],
  ) => Promise<Agent | undefined>;

  // Agent Deployment
  deployAgent: (id: string) => Promise<DeployedAgent | undefined>;
  getDeployedAgents: () => Promise<DeployedAgent[] | undefined>;
  getDeployedAgent: (id: string) => Promise<DeployedAgent | undefined>;
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
  updateSessionMessages: (
    sessionId: string,
    messages: any[],
  ) => Promise<any>;
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

// Electron implementation
class ElectronPlatformAPI implements PlatformAPI {
  // Authentication
  login = (idp?: string) => window.electronAPI.login(idp);
  logout = () => window.electronAPI.logout();
  getAuthStatus = (forceRefresh?: boolean) => window.electronAPI.getAuthStatus(forceRefresh);
  handleAuthToken = (token: string, state?: string) => window.electronAPI.handleAuthToken(token, state);
  onAuthStatusChanged = (callback: (status: { loggedIn: boolean; userId?: string; user?: any }) => void) => 
    window.electronAPI.onAuthStatusChanged(callback);

  // MCP Server Management
  listMcpServers = () => window.electronAPI.listMcpServers();
  startMcpServer = (id: string) => window.electronAPI.startMcpServer(id);
  stopMcpServer = (id: string) => window.electronAPI.stopMcpServer(id);
  addMcpServer = (serverConfig: MCPServerConfig) => window.electronAPI.addMcpServer(serverConfig);
  removeMcpServer = (id: string) => window.electronAPI.removeMcpServer(id);
  getMcpServerStatus = (id: string) => window.electronAPI.getMcpServerStatus(id);
  updateMcpServerConfig = (id: string, config: any) => window.electronAPI.updateMcpServerConfig(id, config);
  fetchMcpServersFromIndex = (page?: number, limit?: number, search?: string, isVerified?: boolean) =>
    window.electronAPI.fetchMcpServersFromIndex(page, limit, search, isVerified);
  fetchMcpServerVersionDetails = (displayId: string, version: string) =>
    window.electronAPI.fetchMcpServerVersionDetails(displayId, version);

  // Logging
  getRequestLogs = (options?: any) => window.electronAPI.getRequestLogs(options);
  getAvailableRequestTypes = () => window.electronAPI.getAvailableRequestTypes();
  getAvailableClientIds = () => window.electronAPI.getAvailableClientIds();
  getClientStats = () => window.electronAPI.getClientStats();
  getServerStats = () => window.electronAPI.getServerStats();
  getRequestTypeStats = () => window.electronAPI.getRequestTypeStats();

  // General server methods
  getServers = () => window.electronAPI.getServers();

  // Invitation & Activation
  fetchInvitation = () => window.electronAPI.fetchInvitation();
  checkActivation = () => window.electronAPI.checkActivation();
  submitInvitationCode = (code: string) => window.electronAPI.submitInvitationCode(code);

  // Settings
  getSettings = () => window.electronAPI.getSettings();
  saveSettings = (settings: AppSettings) => window.electronAPI.saveSettings(settings);
  incrementPackageManagerOverlayCount = () => window.electronAPI.incrementPackageManagerOverlayCount();

  // MCP Apps
  listMcpApps = () => window.electronAPI.listMcpApps();
  addMcpAppConfig = (appName: string) => window.electronAPI.addMcpAppConfig(appName);
  deleteMcpApp = (appName: string) => window.electronAPI.deleteMcpApp(appName);
  updateAppServerAccess = (appName: string, serverIds: string[]) =>
    window.electronAPI.updateAppServerAccess(appName, serverIds);
  unifyAppConfig = (appName: string) => window.electronAPI.unifyAppConfig(appName);

  // Command utilities
  checkCommandExists = (command: string) => window.electronAPI.checkCommandExists(command);

  // Agent Management
  listAgents = () => window.electronAPI.listAgents();
  getAgent = (id: string) => window.electronAPI.getAgent(id);
  createAgent = (agentConfig: Omit<AgentConfig, "id">) => window.electronAPI.createAgent(agentConfig);
  updateAgent = (id: string, config: Partial<AgentConfig>) => window.electronAPI.updateAgent(id, config);
  deleteAgent = (id: string) => window.electronAPI.deleteAgent(id);
  shareAgent = (id: string) => window.electronAPI.shareAgent(id);
  importAgent = (shareCode: string) => window.electronAPI.importAgent(shareCode);
  completeAgentSetup = (id: string, completed: boolean, updatedServers?: any[]) =>
    window.electronAPI.completeAgentSetup(id, completed, updatedServers);

  // Agent Deployment
  deployAgent = (id: string) => window.electronAPI.deployAgent(id);
  getDeployedAgents = () => window.electronAPI.getDeployedAgents();
  getDeployedAgent = (id: string) => window.electronAPI.getDeployedAgent(id);
  updateDeployedAgent = (id: string, config: any) => window.electronAPI.updateDeployedAgent(id, config);
  deleteDeployedAgent = (id: string) => window.electronAPI.deleteDeployedAgent(id);

  // Package Management
  resolvePackageVersionsInArgs = (argsString: string, packageManager: "pnpm" | "uvx") =>
    window.electronAPI.resolvePackageVersionsInArgs(argsString, packageManager);
  checkMcpServerPackageUpdates = (args: string[], packageManager: "pnpm" | "uvx") =>
    window.electronAPI.checkMcpServerPackageUpdates(args, packageManager);

  // Agent Tools
  getAgentMCPServerTools = (agentId: string, serverId: string, isDev?: boolean) =>
    window.electronAPI.getAgentMCPServerTools(agentId, serverId, isDev);
  executeAgentTool = (agentId: string, toolName: string, args: Record<string, any>) =>
    window.electronAPI.executeAgentTool(agentId, toolName, args);

  // Background Chat
  startBackgroundChat = (sessionId: string | undefined, agentId: string, query: string) =>
    window.electronAPI.startBackgroundChat(sessionId, agentId, query);
  stopBackgroundChat = (agentId: string) => window.electronAPI.stopBackgroundChat(agentId);
  onBackgroundChatStart = (callback: (data: any) => void) => window.electronAPI.onBackgroundChatStart(callback);
  onBackgroundChatStop = (callback: (data: any) => void) => window.electronAPI.onBackgroundChatStop(callback);

  // Session Management
  fetchSessionMessages = (sessionId: string) => window.electronAPI.fetchSessionMessages(sessionId);
  getSessions = (agentId: string, options?: any) => window.electronAPI.getSessions(agentId, options);
  createSession = (agentId: string, initialMessages?: any[]) => window.electronAPI.createSession(agentId, initialMessages);
  updateSessionMessages = (sessionId: string, messages: any[]) =>
    window.electronAPI.updateSessionMessages(sessionId, messages);
  deleteSession = (sessionId: string) => window.electronAPI.deleteSession(sessionId);

  // Chat Stream Communication
  sendChatStreamStart = (streamData: any) => window.electronAPI.sendChatStreamStart(streamData);
  sendChatStreamChunk = (chunkData: any) => window.electronAPI.sendChatStreamChunk(chunkData);
  sendChatStreamEnd = (endData: any) => window.electronAPI.sendChatStreamEnd(endData);
  sendChatStreamError = (errorData: any) => window.electronAPI.sendChatStreamError(errorData);

  // Chat Stream Listeners
  onChatStreamStart = (callback: (data: any) => void) => window.electronAPI.onChatStreamStart(callback);
  onChatStreamChunk = (callback: (data: any) => void) => window.electronAPI.onChatStreamChunk(callback);
  onChatStreamEnd = (callback: (data: any) => void) => window.electronAPI.onChatStreamEnd(callback);
  onChatStreamError = (callback: (data: any) => void) => window.electronAPI.onChatStreamError(callback);

  // Token Management
  updateTokenScopes = (tokenId: string, scopes: TokenScope[]) =>
    window.electronAPI.updateTokenScopes(tokenId, scopes);

  // Feedback
  submitFeedback = (feedback: string) => window.electronAPI.submitFeedback(feedback);

  // Updates
  checkForUpdates = () => window.electronAPI.checkForUpdates();
  installUpdate = () => window.electronAPI.installUpdate();
  onUpdateAvailable = (callback: (available: boolean) => void) => window.electronAPI.onUpdateAvailable(callback);

  // Protocol handling
  onProtocolUrl = (callback: (url: string) => void) => window.electronAPI.onProtocolUrl(callback);

  // Package Manager utilities
  checkPackageManagers = () => window.electronAPI.checkPackageManagers();
  installPackageManagers = () => window.electronAPI.installPackageManagers();
  restartApp = () => window.electronAPI.restartApp();
}

// Web implementation (placeholder for future web support)
class WebPlatformAPI implements PlatformAPI {
  // All methods throw "not implemented" errors for now
  // These will be implemented when adding web platform support

  login = async (idp?: string): Promise<boolean> => {
    throw new Error("Web platform not yet implemented");
  };

  logout = async (): Promise<boolean> => {
    throw new Error("Web platform not yet implemented");
  };

  getAuthStatus = async (forceRefresh?: boolean) => {
    throw new Error("Web platform not yet implemented");
  };

  handleAuthToken = async (token: string, state?: string): Promise<boolean> => {
    throw new Error("Web platform not yet implemented");
  };

  onAuthStatusChanged = (callback: (status: any) => void) => {
    throw new Error("Web platform not yet implemented");
  };

  listMcpServers = async () => {
    throw new Error("Web platform not yet implemented");
  };

  startMcpServer = async (id: string): Promise<boolean> => {
    throw new Error("Web platform not yet implemented");
  };

  stopMcpServer = async (id: string): Promise<boolean> => {
    throw new Error("Web platform not yet implemented");
  };

  addMcpServer = async (serverConfig: MCPServerConfig) => {
    throw new Error("Web platform not yet implemented");
  };

  removeMcpServer = async (id: string) => {
    throw new Error("Web platform not yet implemented");
  };

  getMcpServerStatus = async (id: string) => {
    throw new Error("Web platform not yet implemented");
  };

  updateMcpServerConfig = async (id: string, config: any) => {
    throw new Error("Web platform not yet implemented");
  };

  fetchMcpServersFromIndex = async (page?: number, limit?: number, search?: string, isVerified?: boolean) => {
    throw new Error("Web platform not yet implemented");
  };

  fetchMcpServerVersionDetails = async (displayId: string, version: string) => {
    throw new Error("Web platform not yet implemented");
  };

  getRequestLogs = async (options?: any) => {
    throw new Error("Web platform not yet implemented");
  };

  getAvailableRequestTypes = async (): Promise<string[]> => {
    throw new Error("Web platform not yet implemented");
  };

  getAvailableClientIds = async (): Promise<string[]> => {
    throw new Error("Web platform not yet implemented");
  };

  getClientStats = async () => {
    throw new Error("Web platform not yet implemented");
  };

  getServerStats = async () => {
    throw new Error("Web platform not yet implemented");
  };

  getRequestTypeStats = async () => {
    throw new Error("Web platform not yet implemented");
  };

  getServers = async () => {
    throw new Error("Web platform not yet implemented");
  };

  fetchInvitation = async () => {
    throw new Error("Web platform not yet implemented");
  };

  checkActivation = async (): Promise<boolean> => {
    throw new Error("Web platform not yet implemented");
  };

  submitInvitationCode = async (code: string): Promise<boolean> => {
    throw new Error("Web platform not yet implemented");
  };

  getSettings = async (): Promise<AppSettings> => {
    throw new Error("Web platform not yet implemented");
  };

  saveSettings = async (settings: AppSettings): Promise<boolean> => {
    throw new Error("Web platform not yet implemented");
  };

  incrementPackageManagerOverlayCount = async () => {
    throw new Error("Web platform not yet implemented");
  };

  listMcpApps = async (): Promise<McpApp[]> => {
    throw new Error("Web platform not yet implemented");
  };

  addMcpAppConfig = async (appName: string): Promise<McpAppsManagerResult> => {
    throw new Error("Web platform not yet implemented");
  };

  deleteMcpApp = async (appName: string): Promise<boolean> => {
    throw new Error("Web platform not yet implemented");
  };

  updateAppServerAccess = async (appName: string, serverIds: string[]): Promise<McpAppsManagerResult> => {
    throw new Error("Web platform not yet implemented");
  };

  unifyAppConfig = async (appName: string): Promise<McpAppsManagerResult> => {
    throw new Error("Web platform not yet implemented");
  };

  checkCommandExists = async (command: string): Promise<boolean> => {
    throw new Error("Web platform not yet implemented");
  };

  listAgents = async (): Promise<Agent[]> => {
    throw new Error("Web platform not yet implemented");
  };

  getAgent = async (id: string): Promise<Agent | undefined> => {
    throw new Error("Web platform not yet implemented");
  };

  createAgent = async (agentConfig: Omit<AgentConfig, "id">): Promise<Agent> => {
    throw new Error("Web platform not yet implemented");
  };

  updateAgent = async (id: string, config: Partial<AgentConfig>): Promise<Agent | undefined> => {
    throw new Error("Web platform not yet implemented");
  };

  deleteAgent = async (id: string): Promise<boolean> => {
    throw new Error("Web platform not yet implemented");
  };

  shareAgent = async (id: string): Promise<string> => {
    throw new Error("Web platform not yet implemented");
  };

  importAgent = async (shareCode: string): Promise<DeployedAgent | undefined> => {
    throw new Error("Web platform not yet implemented");
  };

  completeAgentSetup = async (id: string, completed: boolean, updatedServers?: any[]): Promise<Agent | undefined> => {
    throw new Error("Web platform not yet implemented");
  };

  deployAgent = async (id: string): Promise<DeployedAgent | undefined> => {
    throw new Error("Web platform not yet implemented");
  };

  getDeployedAgents = async (): Promise<DeployedAgent[] | undefined> => {
    throw new Error("Web platform not yet implemented");
  };

  getDeployedAgent = async (id: string): Promise<DeployedAgent | undefined> => {
    throw new Error("Web platform not yet implemented");
  };

  updateDeployedAgent = async (id: string, config: any): Promise<DeployedAgent | undefined> => {
    throw new Error("Web platform not yet implemented");
  };

  deleteDeployedAgent = async (id: string): Promise<boolean> => {
    throw new Error("Web platform not yet implemented");
  };

  resolvePackageVersionsInArgs = async (argsString: string, packageManager: "pnpm" | "uvx") => {
    throw new Error("Web platform not yet implemented");
  };

  checkMcpServerPackageUpdates = async (args: string[], packageManager: "pnpm" | "uvx") => {
    throw new Error("Web platform not yet implemented");
  };

  getAgentMCPServerTools = async (agentId: string, serverId: string, isDev?: boolean) => {
    throw new Error("Web platform not yet implemented");
  };

  executeAgentTool = async (agentId: string, toolName: string, args: Record<string, any>) => {
    throw new Error("Web platform not yet implemented");
  };

  startBackgroundChat = async (sessionId: string | undefined, agentId: string, query: string) => {
    throw new Error("Web platform not yet implemented");
  };

  stopBackgroundChat = async (agentId: string) => {
    throw new Error("Web platform not yet implemented");
  };

  onBackgroundChatStart = (callback: (data: any) => void) => {
    throw new Error("Web platform not yet implemented");
  };

  onBackgroundChatStop = (callback: (data: any) => void) => {
    throw new Error("Web platform not yet implemented");
  };

  fetchSessionMessages = async (sessionId: string) => {
    throw new Error("Web platform not yet implemented");
  };

  getSessions = async (agentId: string, options?: any) => {
    throw new Error("Web platform not yet implemented");
  };

  createSession = async (agentId: string, initialMessages?: any[]) => {
    throw new Error("Web platform not yet implemented");
  };

  updateSessionMessages = async (sessionId: string, messages: any[]) => {
    throw new Error("Web platform not yet implemented");
  };

  deleteSession = async (sessionId: string): Promise<boolean> => {
    throw new Error("Web platform not yet implemented");
  };

  sendChatStreamStart = async (streamData: any) => {
    throw new Error("Web platform not yet implemented");
  };

  sendChatStreamChunk = async (chunkData: any) => {
    throw new Error("Web platform not yet implemented");
  };

  sendChatStreamEnd = async (endData: any) => {
    throw new Error("Web platform not yet implemented");
  };

  sendChatStreamError = async (errorData: any) => {
    throw new Error("Web platform not yet implemented");
  };

  onChatStreamStart = (callback: (data: any) => void) => {
    throw new Error("Web platform not yet implemented");
  };

  onChatStreamChunk = (callback: (data: any) => void) => {
    throw new Error("Web platform not yet implemented");
  };

  onChatStreamEnd = (callback: (data: any) => void) => {
    throw new Error("Web platform not yet implemented");
  };

  onChatStreamError = (callback: (data: any) => void) => {
    throw new Error("Web platform not yet implemented");
  };

  updateTokenScopes = async (tokenId: string, scopes: TokenScope[]): Promise<McpAppsManagerResult> => {
    throw new Error("Web platform not yet implemented");
  };

  submitFeedback = async (feedback: string): Promise<boolean> => {
    throw new Error("Web platform not yet implemented");
  };

  checkForUpdates = async () => {
    throw new Error("Web platform not yet implemented");
  };

  installUpdate = async (): Promise<boolean> => {
    throw new Error("Web platform not yet implemented");
  };

  onUpdateAvailable = (callback: (available: boolean) => void) => {
    throw new Error("Web platform not yet implemented");
  };

  onProtocolUrl = (callback: (url: string) => void) => {
    throw new Error("Web platform not yet implemented");
  };

  checkPackageManagers = async () => {
    throw new Error("Web platform not yet implemented");
  };

  installPackageManagers = async () => {
    throw new Error("Web platform not yet implemented");
  };

  restartApp = async (): Promise<boolean> => {
    throw new Error("Web platform not yet implemented");
  };
}

// Create the platform API instance
export const platformAPI: PlatformAPI = isElectron() 
  ? new ElectronPlatformAPI() 
  : new WebPlatformAPI();

// Export convenience function for components
export const usePlatformAPI = () => platformAPI;