/**
 * Augment the global Window interface so TypeScript knows about "window.electronAPI".
 */

import { AppSettings } from "@mcp_router/shared";
import {
  Agent,
  AgentConfig,
  DeployedAgent,
  CreateServerInput,
  WorkflowDefinition,
  HookModule,
} from "@mcp_router/shared";
import { McpAppsManagerResult, McpApp } from "@/main/modules/mcp-apps-service";
import { ServerPackageUpdates } from "./lib/utils/backend/package-version-resolver";

declare global {
  interface Window {
    electronAPI: {
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

      listMcpServers: () => Promise<any>;
      startMcpServer: (id: string) => Promise<boolean>;
      stopMcpServer: (id: string) => Promise<boolean>;
      addMcpServer: (input: CreateServerInput) => Promise<any>;
      serverSelectFile: (options: any) => Promise<any>;
      removeMcpServer: (id: string) => Promise<any>;
      updateMcpServerConfig: (id: string, config: any) => Promise<any>;

      getRequestLogs: (options?: {
        clientId?: string;
        serverId?: string;
        requestType?: string;
        startDate?: Date;
        endDate?: Date;
        responseStatus?: "success" | "error";
        cursor?: string;
        limit?: number;
      }) => Promise<{
        logs: any[];
        total: number;
        nextCursor?: string;
        hasMore: boolean;
      }>;

      // Settings Management
      getSettings: () => Promise<AppSettings>;
      saveSettings: (settings: AppSettings) => Promise<boolean>;
      incrementPackageManagerOverlayCount: () => Promise<{
        success: boolean;
        count: number;
      }>;

      // MCP Apps Management
      listMcpApps: () => Promise<McpApp[]>;
      addMcpAppConfig: (appName: string) => Promise<McpAppsManagerResult>;
      deleteMcpApp: (appName: string) => Promise<boolean>;
      [key: string]: any;
      updateAppServerAccess: (
        appName: string,
        serverIds: string[],
      ) => Promise<McpAppsManagerResult>;
      unifyAppConfig: (appName: string) => Promise<McpAppsManagerResult>;

      // Command checking
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

      // Package Version Resolution
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

      // Agent Tool Management
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

      // Session Messages (Local Database)
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

      // Chat Stream Communication (Background -> Main)
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

      // Chat Stream Listeners (Main -> Background)
      onChatStreamStart: (callback: (data: any) => void) => () => void;
      onChatStreamChunk: (callback: (data: any) => void) => () => void;
      onChatStreamEnd: (callback: (data: any) => void) => () => void;
      onChatStreamError: (callback: (data: any) => void) => () => void;

      // Feedback
      submitFeedback: (feedback: string) => Promise<boolean>;

      // Update Management
      checkForUpdates: () => Promise<{ updateAvailable: boolean }>;
      installUpdate: () => Promise<boolean>;
      onUpdateAvailable: (callback: (available: boolean) => void) => () => void;

      // Protocol URL handling
      onProtocolUrl: (callback: (url: string) => void) => () => void;

      // Package Manager Management
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

      // Workspace Management
      listWorkspaces: () => Promise<any[]>;
      createWorkspace: (config: any) => Promise<any>;
      updateWorkspace: (
        id: string,
        updates: any,
      ) => Promise<{ success: boolean }>;
      deleteWorkspace: (id: string) => Promise<{ success: boolean }>;
      switchWorkspace: (id: string) => Promise<{ success: boolean }>;
      getCurrentWorkspace: () => Promise<any>;
      getWorkspaceCredentials: (
        id: string,
      ) => Promise<{ token: string | null }>;
      onWorkspaceSwitched: (callback: (workspace: any) => void) => () => void;
      onWorkspaceConfigChanged: (callback: (config: any) => void) => () => void;

      // Workflow Management
      listWorkflows: () => Promise<WorkflowDefinition[]>;
      getWorkflow: (id: string) => Promise<WorkflowDefinition | null>;
      createWorkflow: (
        workflow: Omit<WorkflowDefinition, "id" | "createdAt" | "updatedAt">,
      ) => Promise<WorkflowDefinition>;
      updateWorkflow: (
        id: string,
        updates: Partial<Omit<WorkflowDefinition, "id" | "createdAt">>,
      ) => Promise<WorkflowDefinition | null>;
      deleteWorkflow: (id: string) => Promise<boolean>;
      setActiveWorkflow: (id: string) => Promise<boolean>;
      disableWorkflow: (id: string) => Promise<boolean>;
      executeWorkflow: (id: string, context?: any) => Promise<any>;
      getEnabledWorkflows: () => Promise<WorkflowDefinition[]>;
      getWorkflowsByType: (
        workflowType: string,
      ) => Promise<WorkflowDefinition[]>;

      // Hook Module Management
      listHookModules: () => Promise<HookModule[]>;
      getHookModule: (id: string) => Promise<HookModule | null>;
      createHookModule: (module: Omit<HookModule, "id">) => Promise<HookModule>;
      updateHookModule: (
        id: string,
        updates: Partial<Omit<HookModule, "id">>,
      ) => Promise<HookModule | null>;
      deleteHookModule: (id: string) => Promise<boolean>;
      executeHookModule: (id: string, context: any) => Promise<any>;
      importHookModule: (module: Omit<HookModule, "id">) => Promise<HookModule>;
      validateHookScript: (
        script: string,
      ) => Promise<{ valid: boolean; error?: string }>;
    };
  }
}
