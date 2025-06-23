/**
 * アプリケーション設定の型定義
 */
import { MCPDisplayRules } from "./rule-types";
/**
 * アプリケーション設定のインターフェース
 */
export interface AppSettings {
    /**
     * 招待コード
     */
    invitationCode?: string;
    /**
     * 招待受け入れ日時
     */
    invitedAt?: string;
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
     * MCP表示ルール
     * ツール、リソース、プロンプトの表示方法をカスタマイズ
     */
    mcpDisplayRules?: MCPDisplayRules;
    /**
     * パッケージマネージャーオーバーレイの表示回数
     */
    packageManagerOverlayDisplayCount?: number;
}
/**
 * デフォルトのアプリケーション設定
 */
export declare const DEFAULT_APP_SETTINGS: AppSettings;
//# sourceMappingURL=settings-types.d.ts.map