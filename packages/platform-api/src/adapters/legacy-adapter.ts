/**
 * Legacy adapter that bridges the new domain-based API with the old flat API
 * This allows gradual migration from the old API to the new structure
 */

import { PlatformAPI, LegacyPlatformAPI } from '../platform-api-interface';
import { AuthAPI } from '../types/domains/auth-api';
import { ServerAPI } from '../types/domains/server-api';
import { AgentAPI } from '../types/domains/agent-api';
import { AppAPI } from '../types/domains/app-api';
import { PackageAPI } from '../types/domains/package-api';
import { SettingsAPI } from '../types/domains/settings-api';
import { LogAPI } from '../types/domains/log-api';
import { WorkspaceAPI } from '../types/domains/workspace-api';

/**
 * Adapts a legacy flat API to the new domain-based structure
 */
export class LegacyPlatformAPIAdapter implements PlatformAPI {
  auth: AuthAPI;
  servers: ServerAPI;
  agents: AgentAPI;
  apps: AppAPI;
  packages: PackageAPI;
  settings: SettingsAPI;
  logs: LogAPI;
  workspaces: WorkspaceAPI;

  constructor(private legacyAPI: LegacyPlatformAPI) {
    // Initialize auth domain
    this.auth = {
      signIn: (provider) => this.legacyAPI.login(provider),
      signOut: () => this.legacyAPI.logout(),
      getStatus: (forceRefresh) => this.legacyAPI.getAuthStatus(forceRefresh),
      handleToken: (token, state) => this.legacyAPI.handleAuthToken(token, state),
      onChange: (callback) => this.legacyAPI.onAuthStatusChanged((status) => 
        callback({
          authenticated: status.loggedIn,
          userId: status.userId,
          user: status.user,
        })
      ),
    };

    // Initialize servers domain
    this.servers = {
      list: () => this.legacyAPI.listMcpServers(),
      get: async (id) => {
        const servers = await this.legacyAPI.listMcpServers();
        return servers.find((s: any) => s.id === id) || null;
      },
      create: (input) => this.legacyAPI.addMcpServer(input.config),
      update: (id, updates) => this.legacyAPI.updateMcpServerConfig(id, updates),
      delete: (id) => this.legacyAPI.removeMcpServer(id),
      start: (id) => this.legacyAPI.startMcpServer(id),
      stop: (id) => this.legacyAPI.stopMcpServer(id),
      getStatus: async (id) => {
        const servers = await this.legacyAPI.listMcpServers();
        const server = servers.find((s: any) => s.id === id);
        return server?.status || { type: 'stopped' };
      },
      fetchFromIndex: (page, limit, search, isVerified) => 
        this.legacyAPI.fetchMcpServersFromIndex(page, limit, search, isVerified),
      fetchVersionDetails: (displayId, version) => 
        this.legacyAPI.fetchMcpServerVersionDetails(displayId, version),
    };

    // Initialize agents domain (with chat functionality)
    this.agents = {
      // Agent management
      list: () => this.legacyAPI.listAgents(),
      get: async (id) => {
        const agent = await this.legacyAPI.getAgent(id);
        return agent || null;
      },
      create: (input) => this.legacyAPI.createAgent(input),
      update: async (id, updates) => {
        const agent = await this.legacyAPI.updateAgent(id, updates);
        if (!agent) throw new Error('Agent not found');
        return agent;
      },
      delete: (id) => this.legacyAPI.deleteAgent(id),
      share: (id) => this.legacyAPI.shareAgent(id),
      import: (shareCode) => this.legacyAPI.importAgent(shareCode),
      
      // Deployment
      deploy: async (id) => {
        const deployedAgent = await this.legacyAPI.deployAgent(id);
        return {
          success: !!deployedAgent,
          deployedAgent,
          error: deployedAgent ? undefined : 'Deployment failed',
        };
      },
      getDeployed: async () => {
        const deployed = await this.legacyAPI.getDeployedAgents();
        return deployed || [];
      },
      updateDeployed: (id, config) => this.legacyAPI.updateDeployedAgent(id, config),
      deleteDeployed: (id) => this.legacyAPI.deleteDeployedAgent(id),
      
      // Tool management
      tools: {
        execute: async (agentId, toolName, args) => {
          const result = await this.legacyAPI.executeAgentTool(agentId, toolName, args);
          return result;
        },
        list: async (agentId, serverId, isDev) => {
          const result = await this.legacyAPI.getAgentMCPServerTools(agentId, serverId, isDev);
          return result.tools || [];
        },
      },
      
      // Session management
      sessions: {
        create: (agentId, initialMessages) => 
          this.legacyAPI.createSession(agentId, initialMessages),
        get: async (sessionId) => {
          const messages = await this.legacyAPI.fetchSessionMessages(sessionId);
          return messages ? { id: sessionId, agentId: '', messages, createdAt: new Date(), updatedAt: new Date() } : null;
        },
        list: (agentId, options) => this.legacyAPI.getSessions(agentId, options),
        delete: (sessionId) => this.legacyAPI.deleteSession(sessionId),
        update: async (sessionId, messages) => {
          await this.legacyAPI.updateSessionMessages(sessionId, messages);
          return { id: sessionId, agentId: '', messages, createdAt: new Date(), updatedAt: new Date() };
        },
      },
      
      // Streaming chat
      stream: {
        start: (data) => this.legacyAPI.sendChatStreamStart(data),
        send: (data) => this.legacyAPI.sendChatStreamChunk(data),
        end: (data) => this.legacyAPI.sendChatStreamEnd(data),
        error: (data) => this.legacyAPI.sendChatStreamError(data),
        onStart: (callback) => this.legacyAPI.onChatStreamStart(callback),
        onChunk: (callback) => this.legacyAPI.onChatStreamChunk(callback),
        onEnd: (callback) => this.legacyAPI.onChatStreamEnd(callback),
        onError: (callback) => this.legacyAPI.onChatStreamError(callback),
      },
      
      // Background chat
      background: {
        start: (sessionId, agentId, query) => 
          this.legacyAPI.startBackgroundChat(sessionId, agentId, query),
        stop: (agentId) => this.legacyAPI.stopBackgroundChat(agentId),
        onStart: (callback) => this.legacyAPI.onBackgroundChatStart(callback),
        onStop: (callback) => this.legacyAPI.onBackgroundChatStop(callback),
      },
    };

    // Initialize apps domain (with token management)
    this.apps = {
      list: () => this.legacyAPI.listMcpApps(),
      create: (appName) => this.legacyAPI.addMcpAppConfig(appName),
      delete: (appName) => this.legacyAPI.deleteMcpApp(appName),
      updateServerAccess: (appName, serverIds) => 
        this.legacyAPI.updateAppServerAccess(appName, serverIds),
      unifyConfig: (appName) => this.legacyAPI.unifyAppConfig(appName),
      
      // Token management
      tokens: {
        updateScopes: (tokenId, scopes) => 
          this.legacyAPI.updateTokenScopes(tokenId, scopes),
        generate: async () => {
          throw new Error('Token generation not available in legacy API');
        },
        revoke: async () => {
          throw new Error('Token revocation not available in legacy API');
        },
        list: async () => {
          throw new Error('Token listing not available in legacy API');
        },
      },
    };

    // Initialize packages domain (with system utilities)
    this.packages = {
      resolveVersions: (argsString, manager) => 
        this.legacyAPI.resolvePackageVersionsInArgs(argsString, manager),
      checkUpdates: (args, manager) => 
        this.legacyAPI.checkMcpServerPackageUpdates(args, manager),
      checkManagers: () => this.legacyAPI.checkPackageManagers(),
      installManagers: () => this.legacyAPI.installPackageManagers(),
      
      // System utilities
      system: {
        getPlatform: () => this.legacyAPI.getPlatform(),
        checkCommand: (command) => this.legacyAPI.checkCommandExists(command),
        restartApp: () => this.legacyAPI.restartApp(),
        checkForUpdates: () => this.legacyAPI.checkForUpdates(),
        installUpdate: () => this.legacyAPI.installUpdate(),
        onUpdateAvailable: (callback) => this.legacyAPI.onUpdateAvailable(callback),
        onProtocolUrl: (callback) => this.legacyAPI.onProtocolUrl(callback),
      },
    };

    // Initialize settings domain
    this.settings = {
      get: () => this.legacyAPI.getSettings(),
      save: (settings) => this.legacyAPI.saveSettings(settings),
      incrementOverlayCount: () => this.legacyAPI.incrementPackageManagerOverlayCount(),
      submitFeedback: (feedback) => this.legacyAPI.submitFeedback(feedback),
    };

    // Initialize logs domain
    this.logs = {
      query: (options) => this.legacyAPI.getRequestLogs(options),
    };

    // Initialize workspaces domain (placeholder - not in legacy API)
    this.workspaces = {
      list: async () => [],
      get: async () => null,
      create: async (input) => ({
        id: '1',
        name: input.name,
        description: input.description,
        settings: input.settings,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      update: async (id, updates) => ({
        id,
        name: updates.name || 'Workspace',
        description: updates.description,
        settings: updates.settings,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      delete: async () => {},
      setActive: async () => {},
      getActive: async () => null,
    };
  }
}