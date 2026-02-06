/**
 * Augment the global Window interface so TypeScript knows about "window.electronAPI".
 */

import type {
  AppSettings,
  CloudSyncStatus,
  MCPTool,
  MCPServer,
  Project,
  ProjectOptimization,
  Skill,
  SkillWithContent,
  CreateSkillInput,
  UpdateSkillInput,
  UnifiedSkill,
  ClientSkillState,
  SetClientSkillStateInput,
  AdoptSkillInput,
  SkillSyncResult,
  SkillVerifyResult,
} from "@mcp_router/shared";
import {
  CreateServerInput,
  WorkflowDefinition,
  HookModule,
} from "@mcp_router/shared";
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
      listMcpServerTools: (id: string) => Promise<MCPTool[]>;
      updateToolPermissions: (
        id: string,
        permissions: Record<string, boolean>,
      ) => Promise<MCPServer>;

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

      // Cloud Sync
      getCloudSyncStatus: () => Promise<CloudSyncStatus>;
      setCloudSyncEnabled: (enabled: boolean) => Promise<CloudSyncStatus>;
      setCloudSyncPassphrase: (passphrase: string) => Promise<void>;
      syncCloudNow: () => Promise<CloudSyncStatus>;

      [key: string]: any;

      // Command checking
      checkCommandExists: (command: string) => Promise<boolean>;

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

      // Projects Management
      listProjects: () => Promise<Project[]>;
      createProject: (input: { name: string }) => Promise<Project>;
      updateProject: (
        id: string,
        updates: {
          name?: string;
          optimization?: ProjectOptimization;
        },
      ) => Promise<Project>;
      deleteProject: (id: string) => Promise<void>;

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

      // Skills Management
      listSkills: () => Promise<Skill[]>;
      getSkill: (id: string) => Promise<Skill | null>;
      getSkillContent: (id: string) => Promise<string | null>;
      getSkillContentFromPath: (skillPath: string) => Promise<string | null>;
      getSkillWithContent: (id: string) => Promise<SkillWithContent | null>;
      createSkill: (input: CreateSkillInput) => Promise<Skill>;
      updateSkill: (id: string, updates: UpdateSkillInput) => Promise<Skill>;
      deleteSkill: (id: string) => Promise<void>;
      openSkillFolder: (id?: string) => Promise<void>;
      importSkill: () => Promise<Skill>;

      // Unified Skills (per-client state management)
      listUnifiedSkills: () => Promise<UnifiedSkill[]>;
      getUnifiedSkill: (id: string) => Promise<UnifiedSkill | null>;
      updateUnifiedSkill: (
        id: string,
        updates: { name?: string; content?: string; globalSync?: boolean; projectId?: string | null },
      ) => Promise<UnifiedSkill>;
      setClientSkillState: (
        input: SetClientSkillStateInput,
      ) => Promise<ClientSkillState>;
      adoptSkill: (input: AdoptSkillInput) => Promise<UnifiedSkill>;
      syncSkills: (skillId?: string) => Promise<SkillSyncResult>;
      verifySkills: () => Promise<SkillVerifyResult>;
      enableForClient: (skillId: string, clientId: string) => Promise<void>;
      disableForClient: (skillId: string, clientId: string) => Promise<void>;
      removeFromClient: (skillId: string, clientId: string) => Promise<void>;
      enableAll: (skillId: string) => Promise<void>;
      disableAll: (skillId: string) => Promise<void>;

      // Marketplace
      marketplaceSearch: (options?: {
        search?: string;
        limit?: number;
        cursor?: string;
      }) => Promise<{
        servers: Array<{
          server: {
            name: string;
            description: string;
            version: string;
            title?: string;
            websiteUrl?: string;
            repository?: {
              url: string;
              source: string;
            };
            icons?: Array<{
              src: string;
              mimeType?: string;
            }>;
            packages?: Array<{
              registryType: "npm" | "pypi" | "oci";
              identifier: string;
              runtimeHint?: string;
              transport: {
                type: "stdio" | "sse" | "streamable-http";
              };
            }>;
          };
          _meta: {
            "io.modelcontextprotocol.registry/official": {
              status: string;
              publishedAt: string;
              isLatest: boolean;
            };
          };
        }>;
        metadata: {
          nextCursor: string | null;
          count: number;
        };
      }>;
      marketplaceDetails: (serverName: string) => Promise<{
        name: string;
        description: string;
        version: string;
        title?: string;
        websiteUrl?: string;
        repository?: {
          url: string;
          source: string;
        };
        icons?: Array<{
          src: string;
          mimeType?: string;
        }>;
        packages?: Array<{
          registryType: "npm" | "pypi" | "oci";
          identifier: string;
          runtimeHint?: string;
          transport: {
            type: "stdio" | "sse" | "streamable-http";
          };
        }>;
      } | null>;
      marketplaceReadme: (repoUrl: string) => Promise<string | null>;
      marketplaceClearCache: () => Promise<{ success: boolean }>;
      marketplaceSkillsSearch: (options?: {
        search?: string;
        limit?: number;
        cursor?: string;
        tags?: string[];
      }) => Promise<{
        skills: Array<{
          skill: {
            id: string;
            name: string;
            description: string;
            version: string;
            author?: string;
            repository?: {
              url: string;
              source: string;
            };
            tags?: string[];
            icon?: string;
          };
          _meta: {
            publishedAt: string;
            downloads?: number;
          };
        }>;
        metadata: {
          nextCursor: string | null;
          count: number;
        };
      }>;
      marketplaceSkillsDetails: (skillId: string) => Promise<{
        id: string;
        name: string;
        description: string;
        version: string;
        author?: string;
        repository?: {
          url: string;
          source: string;
        };
        tags?: string[];
        icon?: string;
      } | null>;
      marketplaceSkillsContent: (repoUrl: string) => Promise<string | null>;
      marketplaceSkillsInstall: (options: {
        skillId: string;
        repoUrl: string;
        targetName?: string;
        projectId?: string | null;
      }) => Promise<{
        success: boolean;
        skillId?: string;
        error?: string;
      }>;
    };
  }
}
