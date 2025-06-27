/**
 * Electron-specific Platform API implementation
 */

import { PlatformAPI } from "@mcp-router/platform-api";

// Electron implementation
export class ElectronPlatformAPI implements PlatformAPI {
  // Authentication
  login = (idp?: string) => window.electronAPI.login(idp);
  logout = () => window.electronAPI.logout();
  getAuthStatus = (forceRefresh?: boolean) =>
    window.electronAPI.getAuthStatus(forceRefresh);
  handleAuthToken = (token: string, state?: string) =>
    window.electronAPI.handleAuthToken(token, state);
  onAuthStatusChanged = (
    callback: (status: {
      loggedIn: boolean;
      userId?: string;
      user?: any;
    }) => void,
  ) => window.electronAPI.onAuthStatusChanged(callback);

  // MCP Server Management
  listMcpServers = () => window.electronAPI.listMcpServers();
  startMcpServer = (id: string) => window.electronAPI.startMcpServer(id);
  stopMcpServer = (id: string) => window.electronAPI.stopMcpServer(id);
  addMcpServer = (serverConfig: any) =>
    window.electronAPI.addMcpServer(serverConfig);
  removeMcpServer = (id: string) => window.electronAPI.removeMcpServer(id);
  updateMcpServerConfig = (id: string, config: any) =>
    window.electronAPI.updateMcpServerConfig(id, config);
  fetchMcpServersFromIndex = (
    page?: number,
    limit?: number,
    search?: string,
    isVerified?: boolean,
  ) =>
    window.electronAPI.fetchMcpServersFromIndex(
      page,
      limit,
      search,
      isVerified,
    );
  fetchMcpServerVersionDetails = (displayId: string, version: string) =>
    window.electronAPI.fetchMcpServerVersionDetails(displayId, version);

  // Logging
  getRequestLogs = (options?: any) =>
    window.electronAPI.getRequestLogs(options);

  // Settings
  getSettings = () => window.electronAPI.getSettings();
  saveSettings = (settings: any) => window.electronAPI.saveSettings(settings);
  incrementPackageManagerOverlayCount = () =>
    window.electronAPI.incrementPackageManagerOverlayCount();

  // MCP Apps
  listMcpApps = () => window.electronAPI.listMcpApps();
  addMcpAppConfig = (appName: string) =>
    window.electronAPI.addMcpAppConfig(appName);
  deleteMcpApp = (appName: string) => window.electronAPI.deleteMcpApp(appName);
  updateAppServerAccess = (appName: string, serverIds: string[]) =>
    window.electronAPI.updateAppServerAccess(appName, serverIds);
  unifyAppConfig = (appName: string) =>
    window.electronAPI.unifyAppConfig(appName);

  // Command utilities
  checkCommandExists = (command: string) =>
    window.electronAPI.checkCommandExists(command);

  // Agent Management
  listAgents = () => window.electronAPI.listAgents();
  getAgent = (id: string) => window.electronAPI.getAgent(id);
  createAgent = (agentConfig: any) =>
    window.electronAPI.createAgent(agentConfig);
  updateAgent = (id: string, config: any) =>
    window.electronAPI.updateAgent(id, config);
  deleteAgent = (id: string) => window.electronAPI.deleteAgent(id);
  shareAgent = (id: string) => window.electronAPI.shareAgent(id);
  importAgent = (shareCode: string) =>
    window.electronAPI.importAgent(shareCode);

  // Agent Deployment
  deployAgent = (id: string) => window.electronAPI.deployAgent(id);
  getDeployedAgents = () => window.electronAPI.getDeployedAgents();
  updateDeployedAgent = (id: string, config: any) =>
    window.electronAPI.updateDeployedAgent(id, config);
  deleteDeployedAgent = (id: string) =>
    window.electronAPI.deleteDeployedAgent(id);

  // Package Management
  resolvePackageVersionsInArgs = (
    argsString: string,
    packageManager: "pnpm" | "uvx",
  ) =>
    window.electronAPI.resolvePackageVersionsInArgs(argsString, packageManager);
  checkMcpServerPackageUpdates = (
    args: string[],
    packageManager: "pnpm" | "uvx",
  ) => window.electronAPI.checkMcpServerPackageUpdates(args, packageManager);

  // Agent Tools
  getAgentMCPServerTools = (
    agentId: string,
    serverId: string,
    isDev?: boolean,
  ) => window.electronAPI.getAgentMCPServerTools(agentId, serverId, isDev);
  executeAgentTool = (
    agentId: string,
    toolName: string,
    args: Record<string, any>,
  ) => window.electronAPI.executeAgentTool(agentId, toolName, args);

  // Background Chat
  startBackgroundChat = (
    sessionId: string | undefined,
    agentId: string,
    query: string,
  ) => window.electronAPI.startBackgroundChat(sessionId, agentId, query);
  stopBackgroundChat = (agentId: string) =>
    window.electronAPI.stopBackgroundChat(agentId);
  onBackgroundChatStart = (callback: (data: any) => void) =>
    window.electronAPI.onBackgroundChatStart(callback);
  onBackgroundChatStop = (callback: (data: any) => void) =>
    window.electronAPI.onBackgroundChatStop(callback);

  // Session Management
  fetchSessionMessages = (sessionId: string) =>
    window.electronAPI.fetchSessionMessages(sessionId);
  getSessions = (agentId: string, options?: any) =>
    window.electronAPI.getSessions(agentId, options);
  createSession = (agentId: string, initialMessages?: any[]) =>
    window.electronAPI.createSession(agentId, initialMessages);
  updateSessionMessages = (sessionId: string, messages: any[]) =>
    window.electronAPI.updateSessionMessages(sessionId, messages);
  deleteSession = (sessionId: string) =>
    window.electronAPI.deleteSession(sessionId);

  // Chat Stream Communication
  sendChatStreamStart = (streamData: any) =>
    window.electronAPI.sendChatStreamStart(streamData);
  sendChatStreamChunk = (chunkData: any) =>
    window.electronAPI.sendChatStreamChunk(chunkData);
  sendChatStreamEnd = (endData: any) =>
    window.electronAPI.sendChatStreamEnd(endData);
  sendChatStreamError = (errorData: any) =>
    window.electronAPI.sendChatStreamError(errorData);

  // Chat Stream Listeners
  onChatStreamStart = (callback: (data: any) => void) =>
    window.electronAPI.onChatStreamStart(callback);
  onChatStreamChunk = (callback: (data: any) => void) =>
    window.electronAPI.onChatStreamChunk(callback);
  onChatStreamEnd = (callback: (data: any) => void) =>
    window.electronAPI.onChatStreamEnd(callback);
  onChatStreamError = (callback: (data: any) => void) =>
    window.electronAPI.onChatStreamError(callback);

  // Token Management
  updateTokenScopes = (tokenId: string, scopes: any[]) =>
    window.electronAPI.updateTokenScopes(tokenId, scopes);

  // Feedback
  submitFeedback = (feedback: string) =>
    window.electronAPI.submitFeedback(feedback);

  // Updates
  checkForUpdates = () => window.electronAPI.checkForUpdates();
  installUpdate = () => window.electronAPI.installUpdate();
  onUpdateAvailable = (callback: (available: boolean) => void) =>
    window.electronAPI.onUpdateAvailable(callback);

  // Protocol handling
  onProtocolUrl = (callback: (url: string) => void) =>
    window.electronAPI.onProtocolUrl(callback);

  // Package Manager utilities
  checkPackageManagers = () => window.electronAPI.checkPackageManagers();
  installPackageManagers = () => window.electronAPI.installPackageManagers();
  restartApp = () => window.electronAPI.restartApp();

  // System utilities
  getPlatform = () => window.electronAPI.getPlatform();
}

// Create and export the Electron platform API instance
export const electronPlatformAPI = new ElectronPlatformAPI();
