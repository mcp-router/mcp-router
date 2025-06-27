/**
 * Platform API factory
 *
 * This module provides utilities for creating platform-specific API instances
 */

import { PlatformAPI } from "./platform-api-interface";

// Platform detection
export const isElectron = () => {
  return typeof window !== "undefined" && window.electronAPI !== undefined;
};

export const isWeb = () => {
  return typeof window !== "undefined" && !window.electronAPI;
};

// Web implementation (placeholder for future web support)
export class WebPlatformAPI implements PlatformAPI {
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

  addMcpServer = async (serverConfig: any) => {
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

  fetchMcpServersFromIndex = async (
    page?: number,
    limit?: number,
    search?: string,
    isVerified?: boolean,
  ) => {
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

  getSettings = async () => {
    throw new Error("Web platform not yet implemented");
  };

  saveSettings = async (settings: any): Promise<boolean> => {
    throw new Error("Web platform not yet implemented");
  };

  incrementPackageManagerOverlayCount = async () => {
    throw new Error("Web platform not yet implemented");
  };

  listMcpApps = async () => {
    throw new Error("Web platform not yet implemented");
  };

  addMcpAppConfig = async (appName: string) => {
    throw new Error("Web platform not yet implemented");
  };

  deleteMcpApp = async (appName: string): Promise<boolean> => {
    throw new Error("Web platform not yet implemented");
  };

  updateAppServerAccess = async (appName: string, serverIds: string[]) => {
    throw new Error("Web platform not yet implemented");
  };

  unifyAppConfig = async (appName: string) => {
    throw new Error("Web platform not yet implemented");
  };

  checkCommandExists = async (command: string): Promise<boolean> => {
    throw new Error("Web platform not yet implemented");
  };

  listAgents = async () => {
    throw new Error("Web platform not yet implemented");
  };

  getAgent = async (id: string) => {
    throw new Error("Web platform not yet implemented");
  };

  createAgent = async (agentConfig: any) => {
    throw new Error("Web platform not yet implemented");
  };

  updateAgent = async (id: string, config: any) => {
    throw new Error("Web platform not yet implemented");
  };

  deleteAgent = async (id: string): Promise<boolean> => {
    throw new Error("Web platform not yet implemented");
  };

  shareAgent = async (id: string): Promise<string> => {
    throw new Error("Web platform not yet implemented");
  };

  importAgent = async (shareCode: string) => {
    throw new Error("Web platform not yet implemented");
  };

  completeAgentSetup = async (
    id: string,
    completed: boolean,
    updatedServers?: any[],
  ) => {
    throw new Error("Web platform not yet implemented");
  };

  deployAgent = async (id: string) => {
    throw new Error("Web platform not yet implemented");
  };

  getDeployedAgents = async () => {
    throw new Error("Web platform not yet implemented");
  };

  getDeployedAgent = async (id: string) => {
    throw new Error("Web platform not yet implemented");
  };

  updateDeployedAgent = async (id: string, config: any) => {
    throw new Error("Web platform not yet implemented");
  };

  deleteDeployedAgent = async (id: string): Promise<boolean> => {
    throw new Error("Web platform not yet implemented");
  };

  resolvePackageVersionsInArgs = async (
    argsString: string,
    packageManager: "pnpm" | "uvx",
  ) => {
    throw new Error("Web platform not yet implemented");
  };

  checkMcpServerPackageUpdates = async (
    args: string[],
    packageManager: "pnpm" | "uvx",
  ) => {
    throw new Error("Web platform not yet implemented");
  };

  getAgentMCPServerTools = async (
    agentId: string,
    serverId: string,
    isDev?: boolean,
  ) => {
    throw new Error("Web platform not yet implemented");
  };

  executeAgentTool = async (
    agentId: string,
    toolName: string,
    args: Record<string, any>,
  ) => {
    throw new Error("Web platform not yet implemented");
  };

  startBackgroundChat = async (
    sessionId: string | undefined,
    agentId: string,
    query: string,
  ) => {
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

  updateTokenScopes = async (tokenId: string, scopes: any[]) => {
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

  getPlatform = async (): Promise<"darwin" | "win32" | "linux"> => {
    // For web platform, we can try to detect the OS from user agent
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes("mac")) return "darwin";
    if (userAgent.includes("win")) return "win32";
    return "linux";
  };
}

/**
 * Factory function to create platform-specific API instance
 * @param customImplementation Optional custom implementation to use
 * @returns Platform API instance
 */
export function createPlatformAPI(
  customImplementation?: PlatformAPI,
): PlatformAPI {
  if (customImplementation) {
    return customImplementation;
  }

  if (isElectron()) {
    throw new Error("Electron platform API must be provided explicitly");
  }

  return new WebPlatformAPI();
}
