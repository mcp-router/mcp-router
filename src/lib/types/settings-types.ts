/**
 * アプリケーション設定の型定義
 */

import { MCPDisplayRules } from '../types/rule-types';

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
export const DEFAULT_APP_SETTINGS: AppSettings = {
  invitationCode: '',
  invitedAt: '',
  userId: '',
  authToken: '',
  loggedInAt: '',
  mcpDisplayRules: {
    toolNameRule: '{name}',
    toolDescriptionRule: '[{serverName}] {description}',
    resourceNameRule: '{name}',
    resourceDescriptionRule: '[{serverName}] {description}',
    promptNameRule: '{name}',
    promptDescriptionRule: '[{serverName}] {description}',
    resourceTemplateNameRule: '{name}',
    resourceTemplateDescriptionRule: '[{serverName}] {description}'
  },
  packageManagerOverlayDisplayCount: 0
};
