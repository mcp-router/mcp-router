/**
 * Electron-specific Platform API implementation
 */

import type { PlatformAPI } from "@mcp_router/shared";
import type {
  AuthAPI,
  ServerAPI,
  AppAPI,
  PackageAPI,
  SettingsAPI,
  CloudSyncAPI,
  LogAPI,
  WorkspaceAPI,
  WorkflowAPI,
  Workspace,
  ProjectsAPI,
} from "@mcp_router/shared";

// Electron implementation of the Platform API
class ElectronPlatformAPI implements PlatformAPI {
  auth: AuthAPI;
  servers: ServerAPI;
  apps: AppAPI;
  packages: PackageAPI;
  settings: SettingsAPI;
  cloudSync: CloudSyncAPI;
  logs: LogAPI;
  workspaces: WorkspaceAPI;
  workflows: WorkflowAPI;
  projects: ProjectsAPI;

  constructor() {
    // Initialize auth domain
    this.auth = {
      signIn: (provider) => window.electronAPI.login(provider),
      signOut: () => window.electronAPI.logout(),
      getStatus: (forceRefresh) =>
        window.electronAPI.getAuthStatus(forceRefresh).then((status) => ({
          authenticated: status.authenticated ?? false,
          userId: status.userId,
          user: status.user,
          token: status.token,
        })),
      handleToken: (token, state) =>
        window.electronAPI.handleAuthToken(token, state),
      onChange: (callback) =>
        window.electronAPI.onAuthStatusChanged((status) =>
          callback({
            authenticated: status.loggedIn,
            userId: status.userId,
            user: status.user,
          }),
        ),
    };

    // Initialize servers domain
    this.servers = {
      list: () => window.electronAPI.listMcpServers(),
      listTools: (id) => window.electronAPI.listMcpServerTools(id),
      get: async (id) => {
        const servers = await window.electronAPI.listMcpServers();
        return servers.find((s: any) => s.id === id) || null;
      },
      create: (input) => window.electronAPI.addMcpServer(input),
      update: (id, updates) =>
        window.electronAPI.updateMcpServerConfig(id, updates),
      updateToolPermissions: (id, permissions) =>
        window.electronAPI.updateToolPermissions(id, permissions),
      delete: (id) => window.electronAPI.removeMcpServer(id),
      start: (id) => window.electronAPI.startMcpServer(id),
      stop: (id) => window.electronAPI.stopMcpServer(id),
      getStatus: async (id) => {
        const servers = await window.electronAPI.listMcpServers();
        const server = servers.find((s: any) => s.id === id);
        return server?.status || { type: "stopped" };
      },
      selectFile: (options) => window.electronAPI.serverSelectFile(options),
    };

    // Initialize apps domain (with token management)
    this.apps = {
      list: () => window.electronAPI.listMcpApps(),
      create: (appName) => window.electronAPI.addMcpAppConfig(appName),
      delete: (appName) => window.electronAPI.deleteMcpApp(appName),
      updateServerAccess: (appName, serverAccess) =>
        window.electronAPI.updateAppServerAccess(appName, serverAccess),
      unifyConfig: (appName) => window.electronAPI.unifyAppConfig(appName),

      // Token management
      tokens: {
        generate: async () => {
          throw new Error("Token generation not available in Electron");
        },
        revoke: async () => {
          throw new Error("Token revocation not available in Electron");
        },
        list: async () => {
          throw new Error("Token listing not available in Electron");
        },
      },
    };

    // Initialize packages domain (with system utilities)
    this.packages = {
      resolveVersions: (argsString, manager) =>
        window.electronAPI.resolvePackageVersionsInArgs(argsString, manager),
      checkUpdates: (args, manager) =>
        window.electronAPI.checkMcpServerPackageUpdates(args, manager),
      checkManagers: () => window.electronAPI.checkPackageManagers(),
      installManagers: () => window.electronAPI.installPackageManagers(),

      // System utilities
      system: {
        getPlatform: () => window.electronAPI.getPlatform(),
        checkCommand: (command) =>
          window.electronAPI.checkCommandExists(command),
        restartApp: () => window.electronAPI.restartApp(),
        checkForUpdates: () => window.electronAPI.checkForUpdates(),
        installUpdate: () => window.electronAPI.installUpdate(),
        onUpdateAvailable: (callback) =>
          window.electronAPI.onUpdateAvailable(callback),
        onProtocolUrl: (callback) => window.electronAPI.onProtocolUrl(callback),
      },
    };

    // Initialize settings domain
    this.settings = {
      get: () => window.electronAPI.getSettings(),
      save: (settings) => window.electronAPI.saveSettings(settings),
      incrementOverlayCount: () =>
        window.electronAPI.incrementPackageManagerOverlayCount(),
      submitFeedback: (feedback) => window.electronAPI.submitFeedback(feedback),
    };

    // Initialize Cloud Sync domain
    this.cloudSync = {
      getStatus: () => window.electronAPI.getCloudSyncStatus(),
      setEnabled: (enabled) => window.electronAPI.setCloudSyncEnabled(enabled),
      setPassphrase: (passphrase) =>
        window.electronAPI.setCloudSyncPassphrase(passphrase),
    };

    // Initialize logs domain
    this.logs = {
      query: async (options) => {
        const result = await window.electronAPI.getRequestLogs(options);
        // Ensure consistent return type with LogQueryResult
        return {
          ...result,
          items: result.logs, // LogQueryResult extends CursorPaginationResult which requires items
          // logs property is already included from spread operator
        };
      },
    };

    // Initialize workspaces domain
    this.workspaces = {
      list: () => window.electronAPI.listWorkspaces(),
      get: async (id) => {
        const workspaces = await window.electronAPI.listWorkspaces();
        return workspaces.find((w: Workspace) => w.id === id) || null;
      },
      create: (input) => window.electronAPI.createWorkspace(input),
      update: async (id, updates) => {
        await window.electronAPI.updateWorkspace(id, updates);
        // Return the updated workspace
        const workspaces = await window.electronAPI.listWorkspaces();
        const updated = workspaces.find((w: Workspace) => w.id === id);
        if (!updated) throw new Error("Workspace not found");
        return updated;
      },
      delete: async (id) => {
        await window.electronAPI.deleteWorkspace(id);
      },
      switch: async (id) => {
        await window.electronAPI.switchWorkspace(id);
      },
      getActive: () => window.electronAPI.getCurrentWorkspace(),
    };

    // Initialize workflows domain (with hook modules)
    this.workflows = {
      // Workflow operations
      workflows: {
        list: () => window.electronAPI.listWorkflows(),
        get: (id) => window.electronAPI.getWorkflow(id),
        create: (workflow) => window.electronAPI.createWorkflow(workflow),
        update: (id, updates) => window.electronAPI.updateWorkflow(id, updates),
        delete: (id) => window.electronAPI.deleteWorkflow(id),
        setActive: (id) => window.electronAPI.setActiveWorkflow(id),
        disable: (id) => window.electronAPI.disableWorkflow(id),
        execute: (id, context) =>
          window.electronAPI.executeWorkflow(id, context),
        listEnabled: () => window.electronAPI.getEnabledWorkflows(),
        listByType: (workflowType) =>
          window.electronAPI.getWorkflowsByType(workflowType),
      },

      // Hook Module operations
      hooks: {
        list: () => window.electronAPI.listHookModules(),
        get: (id) => window.electronAPI.getHookModule(id),
        create: (module) => window.electronAPI.createHookModule(module),
        update: (id, updates) =>
          window.electronAPI.updateHookModule(id, updates),
        delete: (id) => window.electronAPI.deleteHookModule(id),
        execute: (id, context) =>
          window.electronAPI.executeHookModule(id, context),
        import: (module) => window.electronAPI.importHookModule(module),
        validate: (script) => window.electronAPI.validateHookScript(script),
      },
    };

    // Initialize projects domain
    this.projects = {
      list: () => window.electronAPI.listProjects(),
      create: (input) => window.electronAPI.createProject(input),
      update: (id, updates) => window.electronAPI.updateProject(id, updates),
      delete: (id) => window.electronAPI.deleteProject(id),
    };
  }
}

// Create the Platform API instance
export const electronPlatformAPI = new ElectronPlatformAPI();
