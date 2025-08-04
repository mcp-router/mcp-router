import { BrowserWindow } from "electron";
import { getWorkspaceService } from "../../domain/workspace/workspace-service";
import type { Workspace } from "@mcp_router/shared";
import {
  SqliteManager,
  setWorkspaceDatabase,
} from "../../infrastructure/database/core/sqlite-manager";
import { WorkspaceDatabaseMigration } from "../../infrastructure/database/migrations/workspace-database-migration";
import { getDatabaseContext } from "../../infrastructure/database/core/database-context";
import {
  getDatabaseMigration,
  resetAgentRepository,
  resetDeployedAgentRepository,
  resetLogRepository,
  resetServerRepository,
  resetSessionRepository,
  resetSettingsRepository,
  resetTokenRepository,
  resetWorkspaceRepository,
} from "../../infrastructure/database";
import { ServerService } from "../../domain/mcp-core/server/server-service";
import { TokenService } from "../../domain/mcp-core/token/token-service";
import { LogService } from "../mcp-core/log/log-service";
import { SettingsService } from "../settings/settings-service";
import {
  DevelopmentAgentService,
  DeployedAgentService,
  AgentSharingService,
} from "../../domain/agent";
import { HookService } from "../../domain/mcp-core/hook/hook-service";

/**
 * Platform API管理クラス
 * ワークスペースに応じてPlatform APIの実装を切り替える
 */
export class PlatformAPIManager {
  private static instance: PlatformAPIManager | null = null;
  private currentWorkspace: Workspace | null = null;
  private currentDatabase: SqliteManager | null = null;
  private mainWindow: BrowserWindow | null = null;

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

    // マイグレーションを実行
    // デフォルトのワークスペースだけ特別なマイグレーションを使用する
    if (workspace.localConfig?.databasePath !== "mcprouter.db") {
      const migration = new WorkspaceDatabaseMigration(newDatabase);
      migration.runMigrations();
    } else {
      const migration = getDatabaseMigration();
      migration.runMigrations();
    }

    // リポジトリをリセット（新しいデータベースを使用するように）
    resetAgentRepository();
    resetDeployedAgentRepository();
    resetLogRepository();
    resetServerRepository();
    resetSessionRepository();
    resetSettingsRepository();
    resetTokenRepository();
    resetWorkspaceRepository();

    // サービスのシングルトンインスタンスもリセット
    ServerService.resetInstance();
    TokenService.resetInstance();
    LogService.resetInstance();
    SettingsService.resetInstance();
    DevelopmentAgentService.resetInstance();
    DeployedAgentService.resetInstance();
    AgentSharingService.resetInstance();
    HookService.resetInstance();

    // MCPServerManagerの再初期化をトリガー
    // グローバル変数からMCPServerManagerを取得して再初期化
    const getMCPServerManager = (global as any).getMCPServerManager;
    if (getMCPServerManager && typeof getMCPServerManager === "function") {
      const mcpServerManager = getMCPServerManager();
      if (
        mcpServerManager &&
        typeof mcpServerManager.initializeAsync === "function"
      ) {
        // サーバーリストを再読み込み
        await mcpServerManager.initializeAsync();
      }
    }
  }

  /**
   * ワークスペース切り替えハンドラー
   */
  private async handleWorkspaceSwitch(workspace: Workspace): Promise<void> {
    // 先に現在のワークスペースのサーバーを停止
    const getMCPServerManager = (global as any).getMCPServerManager;
    if (getMCPServerManager && typeof getMCPServerManager === "function") {
      const mcpServerManager = getMCPServerManager();
      // 現在のワークスペースでサーバーを停止（ログは現在のDBに記録される）
      mcpServerManager.clearAllServers();
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
