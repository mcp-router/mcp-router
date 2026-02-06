// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from "electron";
import type {
  CreateServerInput,
  ProjectOptimization,
  TokenServerAccess,
  CreateSkillInput,
  UpdateSkillInput,
  CreateAgentPathInput,
  CreateClientAppInput,
  UpdateClientAppInput,
} from "@mcp_router/shared";

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
  syncCloudNow: () => ipcRenderer.invoke("cloud-sync:sync-now"),

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
  updateProject: (
    id: string,
    updates: { name?: string; optimization?: ProjectOptimization },
  ) => ipcRenderer.invoke("project:update", id, updates),
  deleteProject: (id: string) => ipcRenderer.invoke("project:delete", id),

  // Skills Management
  listSkills: () => ipcRenderer.invoke("skill:list"),
  getSkill: (id: string) => ipcRenderer.invoke("skill:get", id),
  getSkillContent: (id: string) => ipcRenderer.invoke("skill:getContent", id),
  getSkillContentFromPath: (skillPath: string) =>
    ipcRenderer.invoke("skill:getContentFromPath", skillPath),
  getSkillWithContent: (id: string) =>
    ipcRenderer.invoke("skill:getWithContent", id),
  createSkill: (input: CreateSkillInput) =>
    ipcRenderer.invoke("skill:create", input),
  updateSkill: (id: string, updates: UpdateSkillInput) =>
    ipcRenderer.invoke("skill:update", id, updates),
  deleteSkill: (id: string) => ipcRenderer.invoke("skill:delete", id),
  openSkillFolder: (id?: string) => ipcRenderer.invoke("skill:openFolder", id),
  importSkill: () => ipcRenderer.invoke("skill:import"),

  // Agent Path Management
  listAgentPaths: () => ipcRenderer.invoke("skill:listAgentPaths"),
  createAgentPath: (input: CreateAgentPathInput) =>
    ipcRenderer.invoke("skill:createAgentPath", input),
  deleteAgentPath: (id: string) =>
    ipcRenderer.invoke("skill:deleteAgentPath", id),
  selectAgentPathFolder: () =>
    ipcRenderer.invoke("skill:selectAgentPathFolder"),

  // Unified Skills (per-client state management)
  listUnifiedSkills: () => ipcRenderer.invoke("skill:list-unified"),
  getUnifiedSkill: (id: string) => ipcRenderer.invoke("skill:get-unified", id),
  setClientSkillState: (input: {
    skillId: string;
    clientId: string;
    state: string;
  }) => ipcRenderer.invoke("skill:set-client-state", input),
  adoptSkill: (input: { skillName: string; sourceClientId: string }) =>
    ipcRenderer.invoke("skill:adopt", input.skillName, input.sourceClientId),
  syncSkills: (skillId?: string) =>
    ipcRenderer.invoke("skill:sync-to-all", skillId),
  verifySkills: () => ipcRenderer.invoke("skill:verify-and-repair"),
  updateUnifiedSkill: (
    id: string,
    updates: {
      name?: string;
      content?: string;
      globalSync?: boolean;
      projectId?: string | null;
    },
  ) => ipcRenderer.invoke("skill:update-unified", id, updates),
  enableForClient: (skillId: string, clientId: string) =>
    ipcRenderer.invoke("skill:enable-for-client", skillId, clientId),
  disableForClient: (skillId: string, clientId: string) =>
    ipcRenderer.invoke("skill:disable-for-client", skillId, clientId),
  removeFromClient: (skillId: string, clientId: string) =>
    ipcRenderer.invoke("skill:remove-from-client", skillId, clientId),
  enableAll: (skillId: string) =>
    ipcRenderer.invoke("skill:enable-all", skillId),
  disableAll: (skillId: string) =>
    ipcRenderer.invoke("skill:disable-all", skillId),

  // Marketplace
  marketplaceSearch: (options?: {
    search?: string;
    limit?: number;
    cursor?: string;
  }) => ipcRenderer.invoke("marketplace:search", options),
  marketplaceDetails: (serverName: string) =>
    ipcRenderer.invoke("marketplace:details", serverName),
  marketplaceReadme: (repoUrl: string) =>
    ipcRenderer.invoke("marketplace:readme", repoUrl),
  marketplaceClearCache: () => ipcRenderer.invoke("marketplace:clearCache"),
  marketplaceGitHubStats: (repoUrl: string) =>
    ipcRenderer.invoke("marketplace:githubStats", repoUrl),
  marketplaceGitHubStatsBatch: (repoUrls: string[]) =>
    ipcRenderer.invoke("marketplace:githubStatsBatch", repoUrls),
  marketplaceSkillsSearch: (options?: {
    search?: string;
    limit?: number;
    cursor?: string;
    tags?: string[];
  }) => ipcRenderer.invoke("marketplace:skills:search", options),
  marketplaceSkillsDetails: (skillId: string) =>
    ipcRenderer.invoke("marketplace:skills:details", skillId),
  marketplaceSkillsContent: (repoUrl: string) =>
    ipcRenderer.invoke("marketplace:skills:content", repoUrl),
  marketplaceSkillsInstall: (options: {
    skillId: string;
    repoUrl: string;
    targetName?: string;
    projectId?: string | null;
  }) => ipcRenderer.invoke("marketplace:skills:install", options),

  // Client Apps Management
  listClientApps: () => ipcRenderer.invoke("client-app:list"),
  getClientApp: (id: string) => ipcRenderer.invoke("client-app:get", id),
  createClientApp: (input: CreateClientAppInput) =>
    ipcRenderer.invoke("client-app:create", input),
  updateClientApp: (id: string, input: UpdateClientAppInput) =>
    ipcRenderer.invoke("client-app:update", id, input),
  deleteClientApp: (id: string) => ipcRenderer.invoke("client-app:delete", id),
  detectClientApps: () => ipcRenderer.invoke("client-app:detect"),
  configureClientApp: (id: string) =>
    ipcRenderer.invoke("client-app:configure", id),
  updateClientAppServerAccess: (id: string, serverAccess: TokenServerAccess) =>
    ipcRenderer.invoke("client-app:update-server-access", id, serverAccess),
  selectClientAppFolder: () => ipcRenderer.invoke("client-app:select-folder"),
  discoverSkillsFromClients: () =>
    ipcRenderer.invoke("client-apps:discover-skills"),
});
