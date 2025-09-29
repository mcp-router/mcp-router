import { Token } from "@mcp_router/shared";
import { getSharedConfigManager } from "../../infrastructure/shared-config-manager";

/**
 * トークン用リポジトリクラス
 * SharedConfigManagerを使用して共通設定ファイルで管理
 */
export class McpAppsManagerRepository {
  private static instance: McpAppsManagerRepository | null = null;

  /**
   * コンストラクタ
   */
  private constructor() {
    console.log(
      "[McpAppsManagerRepository] Using SharedConfigManager for token storage",
    );
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): McpAppsManagerRepository {
    if (!McpAppsManagerRepository.instance) {
      McpAppsManagerRepository.instance = new McpAppsManagerRepository();
    }
    return McpAppsManagerRepository.instance;
  }

  /**
   * インスタンスをリセット
   */
  public static resetInstance(): void {
    McpAppsManagerRepository.instance = null;
  }

  /**
   * トークンを取得
   */
  public getToken(id: string): Token | null {
    const manager = getSharedConfigManager();
    const token = manager.getToken(id);
    return token || null;
  }

  /**
   * トークンを保存
   */
  public saveToken(token: Token): void {
    getSharedConfigManager().saveToken(token);
  }

  /**
   * トークンをリスト表示
   */
  public listTokens(): Token[] {
    return getSharedConfigManager().getTokens();
  }

  /**
   * トークンを削除
   */
  public deleteToken(id: string): boolean {
    try {
      getSharedConfigManager().deleteToken(id);
      return true;
    } catch (error) {
      console.error(`トークン${id}の削除中にエラーが発生しました:`, error);
      return false;
    }
  }

  /**
   * クライアントIDに関連付けられた全てのトークンを削除
   */
  public deleteClientTokens(clientId: string): number {
    try {
      const manager = getSharedConfigManager();
      const beforeCount = manager.getTokensByClientId(clientId).length;
      manager.deleteClientTokens(clientId);
      return beforeCount;
    } catch (error) {
      console.error(
        `クライアント${clientId}のトークン削除中にエラーが発生しました:`,
        error,
      );
      throw error;
    }
  }

  /**
   * トークンのサーバIDsを更新
   */
  public updateTokenServerIds(id: string, serverIds: string[]): boolean {
    try {
      getSharedConfigManager().updateTokenServerIds(id, serverIds);
      return true;
    } catch (error) {
      console.error(`トークン${id}の更新中にエラーが発生しました:`, error);
      return false;
    }
  }

  /**
   * クライアントIDに関連付けられたトークンを取得
   */
  public getTokensByClientId(clientId: string): Token[] {
    try {
      return getSharedConfigManager().getTokensByClientId(clientId);
    } catch (error) {
      console.error(
        `クライアントID ${clientId} のトークン取得中にエラーが発生しました:`,
        error,
      );
      throw error;
    }
  }

  // BaseRepositoryとの互換性のためのメソッド
  public getById(id: string): Token | undefined {
    const manager = getSharedConfigManager();
    return manager.getToken(id);
  }

  public getAll(): Token[] {
    return this.listTokens();
  }

  public add(token: Token): Token {
    this.saveToken(token);
    return token;
  }

  public update(id: string, token: Token): Token | undefined {
    const existing = this.getById(id);
    if (existing) {
      this.saveToken(token);
      return token;
    }
    return undefined;
  }

  public delete(id: string): boolean {
    return this.deleteToken(id);
  }
}
