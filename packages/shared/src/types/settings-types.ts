/**
 * アプリケーション設定の型定義
 */

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
}

/**
 * デフォルトのアプリケーション設定
 */
export const DEFAULT_APP_SETTINGS: AppSettings = {
  userId: "",
  authToken: "",
  loggedInAt: "",
  packageManagerOverlayDisplayCount: 0,
  loadExternalMCPConfigs: true,
  analyticsEnabled: true,
};
