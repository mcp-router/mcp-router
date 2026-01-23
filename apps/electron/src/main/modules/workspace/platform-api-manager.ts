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
import { McpAppsManagerRepository } from "../mcp-apps-manager/mcp-apps-manager.repository";
import { WorkspaceRepository } from "./workspace.repository";
import { ServerService } from "@/main/modules/mcp-server-manager/server-service";
import { McpAppsManagerService } from "../mcp-apps-manager/mcp-apps-manager.service";
import { McpLoggerService } from "@/main/modules/mcp-logger/mcp-logger.service";
import { SettingsService } from "../settings/settings.service";
import type { MCPServerManager } from "@/main/modules/mcp-server-manager/mcp-server-manager";
import { WorkflowRepository } from "../workflow/workflow.repository";
import { HookRepository } from "../workflow/hook.repository";
import { WorkflowService } from "../workflow/workflow.service";
import { HookService } from "../workflow/hook.service";
import { SkillRepository } from "../skills/skills.repository";
import { SkillService } from "../skills/skills.service";

/**
 * Platform API管理クラス
 * ワークスペースに応じてPlatform APIの実装を切り替える
 */
export class PlatformAPIManager {
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
    // ワークスペース切り替えイベントをリッスン
    getWorkspaceService().onWorkspaceSwitched((workspace: Workspace) => {
      this.handleWorkspaceSwitch(workspace);
    });
  }

  /**
   * メインウィンドウを設定
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * MCPServerManager プロバイダを設定
   */
  setServerManagerProvider(provider: () => MCPServerManager): void {
    this.getServerManager = provider;
  }

  /**
   * 初期化
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

    // アクティブなワークスペースを取得
    const activeWorkspace = await getWorkspaceService().getActiveWorkspace();
    if (activeWorkspace) {
      this.currentWorkspace = activeWorkspace;
      await this.configureForWorkspace(activeWorkspace);
    } else {
      // デフォルトワークスペースがない場合は作成
      await getWorkspaceService().switchWorkspace("local-default");
    }
  }

  /**
   * ワークスペースに応じた設定を適用
   */
  private async configureForWorkspace(workspace: Workspace): Promise<void> {
    // 現在のデータベースをクローズ
    if (this.currentDatabase) {
      this.currentDatabase.close();
      this.currentDatabase = null;
      // グローバルなワークスペースデータベース参照をクリア
      setWorkspaceDatabase(null);
    }

    // 新しいデータベースを取得して設定
    const newDatabase = await getWorkspaceService().getWorkspaceDatabase(
      workspace.id,
    );
    this.currentDatabase = newDatabase;

    getDatabaseContext().setCurrentDatabase(newDatabase);

    // グローバルなワークスペースデータベース参照を設定
    setWorkspaceDatabase(newDatabase);

    // マイグレーションを実行（全ワークスペースで実行）
    const migration = new MainDatabaseMigration(newDatabase);
    migration.runMigrations();

    // リポジトリをリセット（新しいデータベースを使用するように）
    McpLoggerRepository.resetInstance();
    McpServerManagerRepository.resetInstance();
    SettingsRepository.resetInstance();
    McpAppsManagerRepository.resetInstance();
    WorkspaceRepository.resetInstance();
    WorkflowRepository.resetInstance();
    HookRepository.resetInstance();
    SkillRepository.resetInstance();

    // サービスのシングルトンインスタンスもリセット
    ServerService.resetInstance();
    McpAppsManagerService.resetInstance();
    McpLoggerService.resetInstance();
    SettingsService.resetInstance();
    WorkflowService.resetInstance();
    HookService.resetInstance();
    SkillService.resetInstance();
    // MCPServerManagerの再初期化をトリガー
    if (this.getServerManager) {
      const serverManager = this.getServerManager();
      if (
        serverManager &&
        typeof serverManager.initializeAsync === "function"
      ) {
        // サーバーリストを再読み込み
        await serverManager.initializeAsync();
      }
    }

    // 新しいワークスペースのサーバーIDを取得してトークンを同期
    // リポジトリ経由で取得し、テーブル初期化を確実化する
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
   * ワークスペース切り替えハンドラー
   */
  private async handleWorkspaceSwitch(workspace: Workspace): Promise<void> {
    // 先に現在のワークスペースのサーバーを停止
    if (this.getServerManager) {
      const serverManager = this.getServerManager();
      // 現在のワークスペースでサーバーを停止（ログは現在のDBに記録される）
      serverManager.clearAllServers();
    }

    // その後、新しいワークスペースに切り替え
    this.currentWorkspace = workspace;
    await this.configureForWorkspace(workspace);

    // レンダラープロセスに通知
    if (this.mainWindow) {
      this.mainWindow.webContents.send("workspace:switched", workspace);
    }
  }

  /**
   * 現在のワークスペースを取得
   */
  getCurrentWorkspace(): Workspace | null {
    return this.currentWorkspace;
  }

  /**
   * 現在のワークスペースがリモートかどうか
   */
  isRemoteWorkspace(): boolean {
    return this.currentWorkspace?.type === "remote";
  }

  /**
   * リモートAPIのベースURLを取得
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
   * 現在のワークスペースのデータベースを取得
   */
  getCurrentDatabase(): SqliteManager | null {
    return this.currentDatabase;
  }

  /**
   * ワークスペースを切り替え（外部から呼び出し可能）
   */
  async switchWorkspace(workspaceId: string): Promise<void> {
    await getWorkspaceService().switchWorkspace(workspaceId);
  }
}

/**
 * PlatformAPIManagerのシングルトンインスタンスを取得
 */
export function getPlatformAPIManager(): PlatformAPIManager {
  return PlatformAPIManager.getInstance();
}
