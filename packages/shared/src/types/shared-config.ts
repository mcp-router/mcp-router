/**
 * 共通設定ファイルの型定義
 * ワークスペース間で共有される設定を管理
 */

import { AppSettings } from "./settings-types";
import { Token } from "./token-types";

/**
 * 共通設定ファイルの構造
 */
export interface SharedConfig {
  /**
   * アプリケーション全体の設定
   */
  settings: AppSettings;

  /**
   * MCP Apps（トークン）の設定
   */
  mcpApps: {
    tokens: Token[];
  };

  /**
   * マイグレーション情報
   */
  _meta?: {
    version: string;
    migratedAt?: string;
    lastModified: string;
  };
}

/**
 * 共通設定マネージャーのインターフェース
 */
export interface ISharedConfigManager {
  /**
   * 設定を取得
   */
  getSettings(): AppSettings;

  /**
   * 設定を保存
   */
  saveSettings(settings: AppSettings): void;

  /**
   * トークンリストを取得
   */
  getTokens(): Token[];

  /**
   * トークンを保存
   */
  saveToken(token: Token): void;

  /**
   * トークンを削除
   */
  deleteToken(tokenId: string): void;

  /**
   * クライアントIDに関連するトークンを削除
   */
  deleteClientTokens(clientId: string): void;

  /**
   * トークンのサーバーIDリストを更新
   */
  updateTokenServerIds(tokenId: string, serverIds: string[]): void;

  /**
   * 設定ファイルを初期化
   */
  initialize(): Promise<void>;

  /**
   * 既存データからマイグレーション
   */
  migrateFromDatabase(workspaceId: string): Promise<void>;

  /**
   * ワークスペースのサーバーリストとトークンを同期
   * 新しいサーバーがあれば自動的にトークンに追加
   */
  syncTokensWithWorkspaceServers(serverIds: string[]): void;
}
