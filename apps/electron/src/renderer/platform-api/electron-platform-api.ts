/**
 * Electron-specific Platform API implementation
 */

import type { PlatformAPI } from "@mcp_router/shared";
import type {
  AuthAPI,
  ServerAPI,
  ServerStatus,
  PackageAPI,
  SettingsAPI,
  CloudSyncAPI,
  LogAPI,
  WorkspaceAPI,
  WorkflowAPI,
  Workspace,
  ProjectsAPI,
  SkillsAPI,
  MarketplaceAPI,
  ClientAppsAPI,
  ClientApp,
  McpServerSearchOptions,
  McpServerSearchResponse,
  SkillsSearchOptions,
  SkillsSearchResponse,
  RegistryServer,
  RegistrySkill,
  InstallSkillInput,
  InstallSkillResult,
  GitHubStats,
} from "@mcp_router/shared";

// Electron implementation of the Platform API
class ElectronPlatformAPI implements PlatformAPI {
  auth: AuthAPI;
  servers: ServerAPI;
  packages: PackageAPI;
  settings: SettingsAPI;
  cloudSync: CloudSyncAPI;
  logs: LogAPI;
  workspaces: WorkspaceAPI;
  workflows: WorkflowAPI;
  projects: ProjectsAPI;
  skills: SkillsAPI;
  marketplace: MarketplaceAPI;
  clientApps: ClientAppsAPI;

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
      update: async (id, updates) => {
        const result = await window.electronAPI.updateMcpServerConfig(id, updates);
        if (!result) throw new Error(`Server not found: ${id}`);
        return result;
      },
      updateToolPermissions: (id, permissions) =>
        window.electronAPI.updateToolPermissions(id, permissions),
      delete: async (id) => {
        await window.electronAPI.removeMcpServer(id);
      },
      start: (id) => window.electronAPI.startMcpServer(id),
      stop: (id) => window.electronAPI.stopMcpServer(id),
      getStatus: async (id) => {
        const servers = await window.electronAPI.listMcpServers();
        const server = servers.find((s) => s.id === id);
        return { type: (server?.status ?? "stopped") as ServerStatus["type"] };
      },
      selectFile: (options) => window.electronAPI.serverSelectFile(options),
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
      syncNow: () => window.electronAPI.syncCloudNow(),
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

    // Initialize skills domain
    this.skills = {
      list: () => window.electronAPI.listSkills(),
      get: (id) => window.electronAPI.getSkill(id),
      getContent: (id) => window.electronAPI.getSkillContent(id),
      getContentFromPath: (skillPath) =>
        window.electronAPI.getSkillContentFromPath(skillPath),
      getWithContent: (id) => window.electronAPI.getSkillWithContent(id),
      create: (input) => window.electronAPI.createSkill(input),
      update: (id, updates) => window.electronAPI.updateSkill(id, updates),
      delete: (id) => window.electronAPI.deleteSkill(id),
      openFolder: (id) => window.electronAPI.openSkillFolder(id),
      import: () => window.electronAPI.importSkill(),
      agentPaths: {
        list: () => window.electronAPI.listAgentPaths(),
        create: (input) => window.electronAPI.createAgentPath(input),
        delete: (id) => window.electronAPI.deleteAgentPath(id),
        selectFolder: () => window.electronAPI.selectAgentPathFolder(),
      },
      // Unified skills operations
      unified: {
        list: () => window.electronAPI.listUnifiedSkills(),
        get: (id) => window.electronAPI.getUnifiedSkill(id),
        update: (id, updates) =>
          window.electronAPI.updateUnifiedSkill(id, updates),
        enableForClient: (skillId: string, clientId: string) =>
          window.electronAPI.enableForClient(skillId, clientId),
        disableForClient: (skillId: string, clientId: string) =>
          window.electronAPI.disableForClient(skillId, clientId),
        enableAll: (skillId: string) => window.electronAPI.enableAll(skillId),
        disableAll: (skillId: string) => window.electronAPI.disableAll(skillId),
        removeFromClient: (skillId: string, clientId: string) =>
          window.electronAPI.removeFromClient(skillId, clientId),
        setClientState: (input) =>
          window.electronAPI.setClientSkillState(input),
        adopt: (input) => window.electronAPI.adoptSkill(input),
        sync: (skillId) => window.electronAPI.syncSkills(skillId),
        verify: () => window.electronAPI.verifySkills(),
      },
    };

    // Initialize marketplace domain
    this.marketplace = {
      servers: {
        search: (
          options?: McpServerSearchOptions,
        ): Promise<McpServerSearchResponse> =>
          window.electronAPI.marketplaceSearch(options),
        getDetails: (serverName: string): Promise<RegistryServer | null> =>
          window.electronAPI.marketplaceDetails(serverName),
        getReadme: (repoUrl: string): Promise<string | null> =>
          window.electronAPI.marketplaceReadme(repoUrl),
        getGitHubStats: (repoUrl: string): Promise<GitHubStats | null> =>
          window.electronAPI.marketplaceGitHubStats(repoUrl),
        getGitHubStatsBatch: (
          repoUrls: string[],
        ): Promise<Record<string, GitHubStats | null>> =>
          window.electronAPI.marketplaceGitHubStatsBatch(repoUrls),
      },
      skills: {
        search: (
          options?: SkillsSearchOptions,
        ): Promise<SkillsSearchResponse> =>
          window.electronAPI.marketplaceSkillsSearch(options),
        getDetails: (skillId: string): Promise<RegistrySkill | null> =>
          window.electronAPI.marketplaceSkillsDetails(skillId),
        getContent: (repoUrl: string): Promise<string | null> =>
          window.electronAPI.marketplaceSkillsContent(repoUrl),
        install: (input: InstallSkillInput): Promise<InstallSkillResult> =>
          window.electronAPI.marketplaceSkillsInstall(input),
      },
      clearCache: async () => {
        await window.electronAPI.marketplaceClearCache();
      },
    };

    // Initialize clientApps domain
    this.clientApps = {
      list: () => window.electronAPI.listClientApps(),
      get: async (id) => {
        const clientApps = await window.electronAPI.listClientApps();
        return clientApps.find((c: ClientApp) => c.id === id) || null;
      },
      create: (input) => window.electronAPI.createClientApp(input),
      update: (id, input) => window.electronAPI.updateClientApp(id, input),
      delete: (id) => window.electronAPI.deleteClientApp(id),
      detect: () => window.electronAPI.detectClientApps(),
      configure: (id) => window.electronAPI.configureClientApp(id),
      updateServerAccess: (id, serverAccess) =>
        window.electronAPI.updateClientAppServerAccess(id, serverAccess),
      selectFolder: async () => {
        const result = await window.electronAPI.selectClientAppFolder();
        return result.path;
      },
      discoverSkillsFromClients: () =>
        window.electronAPI.discoverSkillsFromClients(),
    };
  }
}

// Create the Platform API instance
export const electronPlatformAPI = new ElectronPlatformAPI();
