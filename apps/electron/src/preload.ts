// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from "electron";
import { CreateServerInput } from "@mcp_router/shared";

// Consolidate everything into one contextBridge call

contextBridge.exposeInMainWorld("electronAPI", {
  // Authentication
  login: (idp?: string) => ipcRenderer.invoke("auth:login", idp),
  logout: () => ipcRenderer.invoke("auth:logout"),
  getAuthStatus: (forceRefresh?: boolean) =>
    ipcRenderer.invoke("auth:status", forceRefresh),
  handleAuthToken: (token: string, state?: string) =>
    ipcRenderer.invoke("auth:handle-token", token, state),
  onAuthStatusChanged: (callback: (status: any) => void) => {
    const listener = (_: any, status: any) => callback(status);
    ipcRenderer.on("auth:status-changed", listener);
    return () => {
      ipcRenderer.removeListener("auth:status-changed", listener);
    };
  },

  // MCP Server Management
  listMcpServers: () => ipcRenderer.invoke("mcp:list"),
  startMcpServer: (id: string) => ipcRenderer.invoke("mcp:start", id),
  stopMcpServer: (id: string) => ipcRenderer.invoke("mcp:stop", id),
  addMcpServer: (input: CreateServerInput) =>
    ipcRenderer.invoke("mcp:add", input),
  serverSelectFile: (options: any) =>
    ipcRenderer.invoke("server:selectFile", options),
  removeMcpServer: (id: string) => ipcRenderer.invoke("mcp:remove", id),
  updateMcpServerConfig: (id: string, config: any) =>
    ipcRenderer.invoke("mcp:update-config", id, config),

  // Package Version Resolution
  resolvePackageVersionsInArgs: (
    argsString: string,
    packageManager: "pnpm" | "uvx",
  ) =>
    ipcRenderer.invoke("package:resolve-versions", argsString, packageManager),
  checkMcpServerPackageUpdates: (
    args: string[],
    packageManager: "pnpm" | "uvx",
  ) => ipcRenderer.invoke("package:check-updates", args, packageManager),

  // Logging
  getRequestLogs: (options?: {
    clientId?: string;
    serverId?: string;
    requestType?: string;
    startDate?: Date;
    endDate?: Date;
    responseStatus?: "success" | "error";
    cursor?: string;
    limit?: number;
  }) => ipcRenderer.invoke("requestLogs:get", options),

  // Settings Management
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings: any) =>
    ipcRenderer.invoke("settings:save", settings),
  incrementPackageManagerOverlayCount: () =>
    ipcRenderer.invoke("settings:increment-package-manager-overlay-count"),

  // MCP Apps Management
  listMcpApps: () => ipcRenderer.invoke("mcp-apps:list"),
  addMcpAppConfig: (appName: string) =>
    ipcRenderer.invoke("mcp-apps:add", appName),
  deleteMcpApp: (appName: string) =>
    ipcRenderer.invoke("mcp-apps:delete", appName),
  updateAppServerAccess: (appName: string, serverIds: string[]) =>
    ipcRenderer.invoke("mcp-apps:update-server-access", appName, serverIds),
  unifyAppConfig: (appName: string) =>
    ipcRenderer.invoke("mcp-apps:unify", appName),

  // Agent Management
  listAgents: () => ipcRenderer.invoke("agent:list"),
  getAgent: (id: string) => ipcRenderer.invoke("agent:get", id),
  createAgent: (agentConfig: any) =>
    ipcRenderer.invoke("agent:create", agentConfig),
  updateAgent: (id: string, config: any) =>
    ipcRenderer.invoke("agent:update", id, config),
  deleteAgent: (id: string) => ipcRenderer.invoke("agent:delete", id),
  shareAgent: (id: string) => ipcRenderer.invoke("agent:share", id),
  importAgent: (shareCode: string) =>
    ipcRenderer.invoke("agent:import", shareCode),

  // Agent Deployment
  deployAgent: (id: string) => ipcRenderer.invoke("agent:deploy", id),
  getDeployedAgents: () => ipcRenderer.invoke("agent:deployed-list"),
  updateDeployedAgent: (id: string, config: any) =>
    ipcRenderer.invoke("agent:deployed-update", id, config),
  deleteDeployedAgent: (id: string) =>
    ipcRenderer.invoke("agent:deployed-delete", id),

  // Agent Tool Management
  getAgentMCPServerTools: (
    agentId: string,
    serverId: string,
    isDev?: boolean,
  ) =>
    ipcRenderer.invoke("agent:get-mcp-server-tools", agentId, serverId, isDev),
  executeAgentTool: (
    agentId: string,
    toolName: string,
    args: Record<string, any>,
  ) => ipcRenderer.invoke("agent:execute-tools", agentId, toolName, args),

  // Background Chat
  startBackgroundChat: (
    sessionId: string | undefined,
    agentId: string,
    query: string,
  ) =>
    ipcRenderer.invoke(
      "agent:background-chat-start",
      sessionId,
      agentId,
      query,
    ),
  stopBackgroundChat: (agentId: string) =>
    ipcRenderer.invoke("agent:background-chat-stop", agentId),
  onBackgroundChatStart: (callback: (data: any) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on("background-chat:start", listener);
    return () => {
      ipcRenderer.removeListener("background-chat:start", listener);
    };
  },
  onBackgroundChatStop: (callback: (data: any) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on("background-chat:stop", listener);
    return () => {
      ipcRenderer.removeListener("background-chat:stop", listener);
    };
  },

  // Session Messages (Local Database)
  getSessions: (agentId: string, options?: any) =>
    ipcRenderer.invoke("agent:get-sessions", agentId, options),
  createSession: (agentId: string, initialMessages?: any[]) =>
    ipcRenderer.invoke("agent:create-session", agentId, initialMessages),
  updateSessionMessages: (sessionId: string, messages: any[]) =>
    ipcRenderer.invoke("agent:update-session-messages", sessionId, messages),
  deleteSession: (sessionId: string) =>
    ipcRenderer.invoke("agent:delete-session", sessionId),

  // Chat Stream Communication (Background -> Main)
  sendChatStreamStart: (streamData: any) =>
    ipcRenderer.invoke("agent:chat-stream-start", streamData),
  sendChatStreamChunk: (chunkData: any) =>
    ipcRenderer.invoke("agent:chat-stream-chunk", chunkData),
  sendChatStreamEnd: (endData: any) =>
    ipcRenderer.invoke("agent:chat-stream-end", endData),
  sendChatStreamError: (errorData: any) =>
    ipcRenderer.invoke("agent:chat-stream-error", errorData),

  // Chat Stream Listeners (Main -> Background)
  onChatStreamStart: (callback: (data: any) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on("chat-stream:start", listener);
    return () => {
      ipcRenderer.removeListener("chat-stream:start", listener);
    };
  },
  onChatStreamChunk: (callback: (data: any) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on("chat-stream:chunk", listener);
    return () => {
      ipcRenderer.removeListener("chat-stream:chunk", listener);
    };
  },
  onChatStreamEnd: (callback: (data: any) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on("chat-stream:end", listener);
    return () => {
      ipcRenderer.removeListener("chat-stream:end", listener);
    };
  },
  onChatStreamError: (callback: (data: any) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on("chat-stream:error", listener);
    return () => {
      ipcRenderer.removeListener("chat-stream:error", listener);
    };
  },

  // Command check
  checkCommandExists: (command: string) =>
    ipcRenderer.invoke("system:commandExists", command),

  // Feedback
  submitFeedback: (feedback: string) =>
    ipcRenderer.invoke("system:submitFeedback", feedback),

  // Update Management
  checkForUpdates: () => ipcRenderer.invoke("system:checkForUpdates"),
  installUpdate: () => ipcRenderer.invoke("system:installUpdate"),
  onUpdateAvailable: (callback: (available: boolean) => void) => {
    const listener = (_: any, available: boolean) => callback(available);
    ipcRenderer.on("update:downloaded", listener);
    return () => {
      ipcRenderer.removeListener("update:downloaded", listener);
    };
  },

  // Package Manager Management
  checkPackageManagers: () => ipcRenderer.invoke("packageManager:checkAll"),
  installPackageManagers: () => ipcRenderer.invoke("packageManager:installAll"),
  restartApp: () => ipcRenderer.invoke("system:restartApp"),

  // Protocol URL handling
  onProtocolUrl: (callback: (url: string) => void) => {
    const listener = (_: any, url: string) => callback(url);
    ipcRenderer.on("protocol:url", listener);
    return () => {
      ipcRenderer.removeListener("protocol:url", listener);
    };
  },

  // System
  getPlatform: () => ipcRenderer.invoke("system:getPlatform"),

  // Workspace Management
  listWorkspaces: () => ipcRenderer.invoke("workspace:list"),
  createWorkspace: (config: any) =>
    ipcRenderer.invoke("workspace:create", config),
  updateWorkspace: (id: string, updates: any) =>
    ipcRenderer.invoke("workspace:update", id, updates),
  deleteWorkspace: (id: string) => ipcRenderer.invoke("workspace:delete", id),
  switchWorkspace: (id: string) => ipcRenderer.invoke("workspace:switch", id),
  getCurrentWorkspace: () => ipcRenderer.invoke("workspace:current"),

  // Workflow Management
  listWorkflows: () => ipcRenderer.invoke("workflow:list"),
  getWorkflow: (id: string) => ipcRenderer.invoke("workflow:get", id),
  createWorkflow: (workflow: any) =>
    ipcRenderer.invoke("workflow:create", workflow),
  updateWorkflow: (id: string, updates: any) =>
    ipcRenderer.invoke("workflow:update", id, updates),
  deleteWorkflow: (id: string) => ipcRenderer.invoke("workflow:delete", id),
  setActiveWorkflow: (id: string) =>
    ipcRenderer.invoke("workflow:setActive", id),
  disableWorkflow: (id: string) => ipcRenderer.invoke("workflow:disable", id),
  executeWorkflow: (id: string, context?: any) =>
    ipcRenderer.invoke("workflow:execute", id, context),
  getEnabledWorkflows: () => ipcRenderer.invoke("workflow:listEnabled"),
  getWorkflowsByType: (workflowType: string) =>
    ipcRenderer.invoke("workflow:listByType", workflowType),

  // Hook Module Management
  listHookModules: () => ipcRenderer.invoke("hook-module:list"),
  getHookModule: (id: string) => ipcRenderer.invoke("hook-module:get", id),
  createHookModule: (module: any) =>
    ipcRenderer.invoke("hook-module:create", module),
  updateHookModule: (id: string, updates: any) =>
    ipcRenderer.invoke("hook-module:update", id, updates),
  deleteHookModule: (id: string) =>
    ipcRenderer.invoke("hook-module:delete", id),
  executeHookModule: (id: string, context: any) =>
    ipcRenderer.invoke("hook-module:execute", id, context),
  importHookModule: (module: any) =>
    ipcRenderer.invoke("hook-module:import", module),
  validateHookScript: (script: string) =>
    ipcRenderer.invoke("hook-module:validate", script),

  getWorkspaceCredentials: (id: string) =>
    ipcRenderer.invoke("workspace:get-credentials", id),
  onWorkspaceSwitched: (callback: (workspace: any) => void) => {
    const listener = (_: any, workspace: any) => callback(workspace);
    ipcRenderer.on("workspace:switched", listener);
    return () => {
      ipcRenderer.removeListener("workspace:switched", listener);
    };
  },
});
