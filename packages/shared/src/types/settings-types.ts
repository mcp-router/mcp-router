import type { Theme } from "./ui";
import type { CloudSyncState } from "./cloud-sync";
import type { SubscriptionStatus } from "./auth";

/**
 * アプリケーション設定のインターフェース
 */
export interface AppSettings {
  /**
   * ユーザーID
   */
  userId?: string;

  /**
   * 認証トークン
   */
  authToken?: string;

  /**
   * ログイン日時
   */
  loggedInAt?: string;

  /**
   * サブスクリプションステータス
   */
  subscriptionStatus?: SubscriptionStatus | null;

  /**
   * プラン名
   */
  planName?: string | null;

  /**
   * パッケージマネージャーオーバーレイの表示回数
   */
  packageManagerOverlayDisplayCount?: number;

  /**
   * 外部アプリケーションからのMCP設定の読み込みを有効化するか
   * デフォルト: true
   */
  loadExternalMCPConfigs?: boolean;

  /**
   * アナリティクスの送信を有効化するか
   * デフォルト: true
   */
  analyticsEnabled?: boolean;

  /**
   * 自動アップデートを有効化するか
   * デフォルト: true
   */
  autoUpdateEnabled?: boolean;

  /**
   * OS起動時にアプリのメインウィンドウを表示するか
   * デフォルト: true
   */
  showWindowOnStartup?: boolean;

  /**
   * アプリケーションのテーマ設定
   * デフォルト: "system"
   */
  theme?: Theme;

  /**
   * Cloud Syncの状態
   */
  cloudSync?: CloudSyncState;
}

/**
 * デフォルトのアプリケーション設定
 */
export const DEFAULT_APP_SETTINGS: AppSettings = {
  userId: "",
  authToken: "",
  loggedInAt: "",
  subscriptionStatus: null,
  planName: null,
  packageManagerOverlayDisplayCount: 0,
  loadExternalMCPConfigs: true,
  analyticsEnabled: true,
  autoUpdateEnabled: true,
  showWindowOnStartup: true,
  theme: "system",
  cloudSync: {
    enabled: false,
  },
};
