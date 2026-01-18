// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from "electron";
import type { CreateServerInput, TokenServerAccess } from "@mcp_router/shared";

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
  listMcpServerTools: (id: string) => ipcRenderer.invoke("mcp:list-tools", id),
  updateToolPermissions: (id: string, permissions: Record<string, boolean>) =>
    ipcRenderer.invoke("mcp:update-tool-permissions", id, permissions),

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

  // Cloud Sync
  getCloudSyncStatus: () => ipcRenderer.invoke("cloud-sync:status"),
  setCloudSyncEnabled: (enabled: boolean) =>
    ipcRenderer.invoke("cloud-sync:set-enabled", enabled),
  setCloudSyncPassphrase: (passphrase: string) =>
    ipcRenderer.invoke("cloud-sync:set-passphrase", passphrase),

  // MCP Apps Management
  listMcpApps: () => ipcRenderer.invoke("mcp-apps:list"),
  addMcpAppConfig: (appName: string) =>
    ipcRenderer.invoke("mcp-apps:add", appName),
  deleteMcpApp: (appName: string) =>
    ipcRenderer.invoke("mcp-apps:delete", appName),
  updateAppServerAccess: (appName: string, serverAccess: TokenServerAccess) =>
    ipcRenderer.invoke("mcp-apps:update-server-access", appName, serverAccess),
  unifyAppConfig: (appName: string) =>
    ipcRenderer.invoke("mcp-apps:unify", appName),

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

  // Projects Management
  listProjects: () => ipcRenderer.invoke("project:list"),
  createProject: (input: { name: string }) =>
    ipcRenderer.invoke("project:create", input),
  updateProject: (id: string, updates: { name?: string }) =>
    ipcRenderer.invoke("project:update", id, updates),
  deleteProject: (id: string) => ipcRenderer.invoke("project:delete", id),
});
