import { setupAuthHandlers } from "./handlers/auth-handler";
import { setupMcpServerHandlers } from "./handlers/server-handler";
import { setupLogHandlers } from "./handlers/log-handler";
import { setupSettingsHandlers } from "./handlers/settings-handler";
import { setupMcpAppsHandlers } from "./handlers/mcp-apps-handler";
import { setupTokenHandlers } from "./handlers/token-handler";
import { setupFeedbackHandlers } from "./handlers/feedback-handler";
import { setupUtilityHandlers } from "./handlers/utility-handler";
import { setupUpdateHandlers } from "./handlers/update-handler";
import { registerPackageVersionHandlers } from "@/main/handlers/package-version-handler";
import { registerPackageManagerHandlers } from "@/main/handlers/package-manager-handler";
import { setupAgentHandlers } from "@/main/handlers/agent-handler";
import { registerWorkspaceHandlers } from "@/main/handlers/workspace-handlers";

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

  // ユーティリティ関連
  setupUtilityHandlers();

  // トークン関連
  setupTokenHandlers();

  // フィードバック関連
  setupFeedbackHandlers();

  // アップデート関連
  setupUpdateHandlers();

  // パッケージバージョン解決関連
  registerPackageVersionHandlers();

  // パッケージマネージャー関連
  registerPackageManagerHandlers();

  // エージェント関連
  setupAgentHandlers();

  // ワークスペース関連
  registerWorkspaceHandlers();
}
