import { BrowserWindow } from "electron";
import { getWorkspaceService } from "@/main/modules/workspace/workspace.service";
import type { Workspace } from "@mcp_router/shared";
import {
  SqliteManager,
  setWorkspaceDatabase,
} from "../../infrastructure/database/sqlite-manager";
import { getDatabaseContext } from "./database-context";
import { MainDatabaseMigration } from "../../infrastructure/database/main-database-migration";
import { getSharedConfigManager } from "../../infrastructure/shared-config-manager";
import { McpLoggerRepository } from "../mcp-logger/mcp-logger.repository";
import { McpServerManagerRepository } from "../mcp-server-manager/mcp-server-manager.repository";
import { SettingsRepository } from "../settings/settings.repository";
import { TokenManagerRepository } from "../client-apps/token-manager.repository";
import { WorkspaceRepository } from "./workspace.repository";
import { ServerService } from "@/main/modules/mcp-server-manager/server-service";
import { McpLoggerService } from "@/main/modules/mcp-logger/mcp-logger.service";
import { SettingsService } from "../settings/settings.service";
import type { MCPServerManager } from "@/main/modules/mcp-server-manager/mcp-server-manager";
import { WorkflowRepository } from "../workflow/workflow.repository";
import { HookRepository } from "../workflow/hook.repository";
import { WorkflowService } from "../workflow/workflow.service";
import { HookService } from "../workflow/hook.service";
import { SkillRepository } from "../skills/skills.repository";
import { SkillService } from "../skills/skills.service";
import { ClientSkillStateRepository } from "../skills/client-skill-state.repository";
import { AgentPathRepository } from "../skills/agent-path.repository";
import { UnifiedSkillsService } from "../skills/unified-skills.service";
import { ServerDiscoveryService } from "../mcp-server-manager/server-discovery.service";
import { resetSamplingProxy } from "../mcp-server-runtime/sampling-proxy";
import { AuditLogRepository } from "../mcp-logger/audit-log.repository";
import { AuditLogService } from "../mcp-logger/audit-log.service";
import {
  TaskRegistry,
} from "../mcp-server-runtime/task-registry";
import { TokenBudgetTracker } from "../mcp-server-runtime/token-budget-tracker";
import { resetHealthMetricsTracker } from "../mcp-server-runtime/health-metrics-tracker";
import { resetRateLimiter } from "../mcp-server-runtime/rate-limiter";
import { ClientAppService } from "../client-apps/client-app.service";

/**
 * Platform API management class.
 * Switches Platform API implementation based on the active workspace.
 */
class PlatformAPIManager {
  private static instance: PlatformAPIManager | null = null;
  private currentWorkspace: Workspace | null = null;
  private currentDatabase: SqliteManager | null = null;
  private mainWindow: BrowserWindow | null = null;
  private getServerManager?: () => MCPServerManager;

  public static getInstance(): PlatformAPIManager {
    if (!PlatformAPIManager.instance) {
      PlatformAPIManager.instance = new PlatformAPIManager();
    }
    return PlatformAPIManager.instance;
  }

  private constructor() {
    // Listen for workspace switch events
    getWorkspaceService().onWorkspaceSwitched((workspace: Workspace) => {
      this.handleWorkspaceSwitch(workspace);
    });
  }

  /**
   * Set the main window
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Set the MCPServerManager provider
   */
  setServerManagerProvider(provider: () => MCPServerManager): void {
    this.getServerManager = provider;
  }

  /**
   * Initialize
   */
  async initialize(): Promise<void> {
    // Configure database provider to avoid circular dependencies
    getDatabaseContext().setDatabaseProvider(async () => {
      const db = this.getCurrentDatabase();
      if (db) {
        return db;
      }

      const workspaceService = getWorkspaceService();
      const activeWorkspace = await workspaceService.getActiveWorkspace();
      if (!activeWorkspace) {
        throw new Error("No active workspace found");
      }

      return await workspaceService.getWorkspaceDatabase(activeWorkspace.id);
    });

    // Get the active workspace
    const activeWorkspace = await getWorkspaceService().getActiveWorkspace();
    if (activeWorkspace) {
      this.currentWorkspace = activeWorkspace;
      await this.configureForWorkspace(activeWorkspace);
    } else {
      // Create a default workspace if none exists
      await getWorkspaceService().switchWorkspace("local-default");
    }
  }

  /**
   * Apply configuration for a given workspace
   */
  private async configureForWorkspace(workspace: Workspace): Promise<void> {
    // Close the current database
    if (this.currentDatabase) {
      this.currentDatabase.close();
      this.currentDatabase = null;
      // Clear the global workspace database reference
      setWorkspaceDatabase(null);
    }

    // Get and set the new database
    const newDatabase = await getWorkspaceService().getWorkspaceDatabase(
      workspace.id,
    );
    this.currentDatabase = newDatabase;

    getDatabaseContext().setCurrentDatabase(newDatabase);

    // Set the global workspace database reference
    setWorkspaceDatabase(newDatabase);

    // Run migrations (executed for all workspaces)
    const migration = new MainDatabaseMigration(newDatabase);
    migration.runMigrations();

    // Reset repositories (to use the new database)
    McpLoggerRepository.resetInstance();
    McpServerManagerRepository.resetInstance();
    SettingsRepository.resetInstance();
    TokenManagerRepository.resetInstance();
    WorkspaceRepository.resetInstance();
    WorkflowRepository.resetInstance();
    HookRepository.resetInstance();
    SkillRepository.resetInstance();
    ClientSkillStateRepository.resetInstance();
    AgentPathRepository.resetInstance();
    AuditLogRepository.resetInstance();

    // Also reset service singleton instances
    ServerService.resetInstance();
    McpLoggerService.resetInstance();
    SettingsService.resetInstance();
    WorkflowService.resetInstance();
    HookService.resetInstance();
    SkillService.resetInstance();
    UnifiedSkillsService.resetInstance();
    ServerDiscoveryService.resetInstance();
    AuditLogService.resetInstance();
    ClientAppService.resetInstance();

    // Reset non-class singletons
    resetSamplingProxy();
    TaskRegistry.resetInstance();
    TokenBudgetTracker.resetInstance();
    resetHealthMetricsTracker();
    resetRateLimiter();

    // Trigger MCPServerManager re-initialization
    if (this.getServerManager) {
      const serverManager = this.getServerManager();
      if (
        serverManager &&
        typeof serverManager.initializeAsync === "function"
      ) {
        // Reload the server list
        await serverManager.initializeAsync();
      }
    }

    // Get server IDs for the new workspace and sync tokens
    // Retrieve via repository to ensure table initialization
    let serverList: string[] = [];
    try {
      const serverRepo = McpServerManagerRepository.getInstance();
      serverList = serverRepo.getAllServers().map((s) => s.id);
    } catch (e) {
      console.error("Failed to load servers via repository for token sync:", e);
      serverList = [];
    }

    if (serverList.length > 0) {
      getSharedConfigManager().syncTokensWithWorkspaceServers(serverList);
    }
  }

  /**
   * Workspace switch handler
   */
  private async handleWorkspaceSwitch(workspace: Workspace): Promise<void> {
    // First stop the servers in the current workspace
    if (this.getServerManager) {
      const serverManager = this.getServerManager();
      // Stop servers in the current workspace (logs are written to the current DB)
      serverManager.clearAllServers();
    }

    // Then switch to the new workspace
    this.currentWorkspace = workspace;
    await this.configureForWorkspace(workspace);

    // Notify the renderer process
    if (this.mainWindow) {
      this.mainWindow.webContents.send("workspace:switched", workspace);
    }
  }

  /**
   * Get the current workspace
   */
  getCurrentWorkspace(): Workspace | null {
    return this.currentWorkspace;
  }

  /**
   * Check whether the current workspace is remote
   */
  isRemoteWorkspace(): boolean {
    return this.currentWorkspace?.type === "remote";
  }

  /**
   * Get the remote API base URL
   */
  getRemoteApiUrl(): string | null {
    if (
      this.isRemoteWorkspace() &&
      this.currentWorkspace?.remoteConfig?.apiUrl
    ) {
      return this.currentWorkspace.remoteConfig.apiUrl;
    }
    return null;
  }

  /**
   * Get the database for the current workspace
   */
  getCurrentDatabase(): SqliteManager | null {
    return this.currentDatabase;
  }

  /**
   * Switch workspace (callable externally)
   */
  async switchWorkspace(workspaceId: string): Promise<void> {
    await getWorkspaceService().switchWorkspace(workspaceId);
  }
}

/**
 * Get the PlatformAPIManager singleton instance
 */
export function getPlatformAPIManager(): PlatformAPIManager {
  return PlatformAPIManager.getInstance();
}
