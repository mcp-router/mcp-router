import { setupAuthHandlers } from "../../modules/auth/auth.ipc";
import { setupMcpServerHandlers } from "./handlers/server-handler";
import { setupLogHandlers } from "./handlers/log-handler";
import { setupSettingsHandlers } from "../../modules/settings/settings.ipc";
import { setupMcpAppsHandlers } from "./handlers/mcp-apps-handler";
import { setupSystemHandlers } from "./handlers/system-handler";
import { setupPackageVersionHandlers } from "./handlers/package-version-handlers";
import { setupPackageManagerHandlers } from "./handlers/package-manager-handlers";
import { setupAgentHandlers } from "./handlers/agent-handlers";
import { setupWorkspaceHandlers } from "../../modules/workspace/workspace.ipc";
import { setupWorkflowHandlers } from "../../modules/workflow/workflow.ipc";
import { setupHookHandlers } from "../../modules/workflow/hook.ipc";

/**
 * IPC通信ハンドラのセットアップを行う関数
 * アプリケーション初期化時に呼び出される
 */
export function setupIpcHandlers(): void {
  // 認証関連
  setupAuthHandlers();

  // MCPサーバー関連
  setupMcpServerHandlers();

  // ログ関連
  setupLogHandlers();

  // 設定関連
  setupSettingsHandlers();

  // MCPアプリ設定関連
  setupMcpAppsHandlers();

  // システム関連（ユーティリティ、フィードバック、アップデート）
  setupSystemHandlers();

  // パッケージバージョン解決関連
  setupPackageVersionHandlers();

  // パッケージマネージャー関連
  setupPackageManagerHandlers();

  // エージェント関連
  setupAgentHandlers();

  // ワークスペース関連
  setupWorkspaceHandlers();

  // Workflow関連
  setupWorkflowHandlers();

  // Hook Module関連
  setupHookHandlers();
}
