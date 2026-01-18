import { setupAuthHandlers } from "../modules/auth/auth.ipc";
import { setupMcpServerHandlers } from "../modules/mcp-server-manager/mcp-server-manager.ipc";
import { setupLogHandlers } from "../modules/mcp-logger/mcp-logger.ipc";
import { setupSettingsHandlers } from "../modules/settings/settings.ipc";
import { setupMcpAppsHandlers } from "../modules/mcp-apps-manager/mcp-apps-manager.ipc";
import { setupSystemHandlers } from "../modules/system/system-handler";
import { setupPackageHandlers } from "../modules/system/package-handlers";
import { setupWorkspaceHandlers } from "../modules/workspace/workspace.ipc";
import { setupWorkflowHandlers } from "../modules/workflow/workflow.ipc";
import { setupHookHandlers } from "../modules/workflow/hook.ipc";
import { setupProjectHandlers } from "../modules/projects/projects.ipc";
import { setupCloudSyncHandlers } from "../modules/cloud-sync/cloud-sync.ipc";
import type { MCPServerManager } from "@/main/modules/mcp-server-manager/mcp-server-manager";

/**
 * IPC通信ハンドラのセットアップを行う関数
 * アプリケーション初期化時に呼び出される
 */
export function setupIpcHandlers(deps: {
  getServerManager: () => MCPServerManager;
}): void {
  // 認証関連
  setupAuthHandlers();

  // MCPサーバー関連
  setupMcpServerHandlers(deps.getServerManager);

  // ログ関連
  setupLogHandlers();

  // 設定関連
  setupSettingsHandlers();

  // MCPアプリ設定関連
  setupMcpAppsHandlers();

  // システム関連（ユーティリティ、フィードバック、アップデート）
  setupSystemHandlers();

  // パッケージ関連（バージョン解決とマネージャー管理）
  setupPackageHandlers();

  // ワークスペース関連
  setupWorkspaceHandlers();

  // Workflow関連
  setupWorkflowHandlers();

  // Hook Module関連
  setupHookHandlers();

  // Projects関連
  setupProjectHandlers({ getServerManager: deps.getServerManager });

  // Cloud Sync関連
  setupCloudSyncHandlers();
}
