import { BaseRepository } from './base-repository';
import { SqliteManager, getSqliteManager } from './sqlite-manager';
import { Token, TokenScope } from '../types/token-types';

/**
 * トークン用リポジトリクラス
 * BetterSQLite3を使用してトークンを管理
 */
export class TokenRepository extends BaseRepository<Token> {
  /**
   * コンストラクタ
   * @param db SqliteManagerインスタンス
   */
  constructor(db: SqliteManager) {
    super(db, 'tokens');
  }
  
  /**
   * テーブルとインデックスを初期化
   * 注: このメソッドはテーブルの初期作成のみを行います
   * スキーマのマイグレーションはDatabaseMigrationクラスで一元管理されます
   */
  protected initializeTable(): void {
    try {
      // tokensテーブルの作成（存在しない場合）
      this.db.execute(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          id TEXT PRIMARY KEY,
          client_id TEXT NOT NULL,
          issued_at INTEGER NOT NULL,
          server_ids TEXT NOT NULL,
          scopes TEXT DEFAULT '[]'
        )
      `);
      
      // インデックスの作成
      this.db.execute(`CREATE INDEX IF NOT EXISTS idx_tokens_client_id ON ${this.tableName} (client_id)`);
    } catch (error) {
      console.error('トークンテーブルの初期化中にエラーが発生しました:', error);
      throw error;
    }
  }
  
  /**
   * DBの行をエンティティに変換
   */
  protected mapRowToEntity(row: any): Token {
    try {
      // サーバIDsとスコープをJSONからパース
      const serverIds = JSON.parse(row.server_ids);
      let scopes: TokenScope[] = [];
      
      // scopesフィールドがある場合はパース、ない場合は全スコープ付与
      if (row.scopes) {
        try {
          scopes = JSON.parse(row.scopes);
        } catch (e) {
          console.warn(`トークン ${row.id} のスコープデータが無効です:`, e);
          scopes = [TokenScope.MCP_SERVER_MANAGEMENT, TokenScope.LOG_MANAGEMENT, TokenScope.APPLICATION];
        }
      } else {
        // 既存トークンには全てのスコープを付与
        scopes = [TokenScope.MCP_SERVER_MANAGEMENT, TokenScope.LOG_MANAGEMENT, TokenScope.APPLICATION];
      }
      
      // エンティティオブジェクトを構築
      return {
        id: row.id,
        clientId: row.client_id,
        issuedAt: row.issued_at,
        serverIds: serverIds,
        scopes: scopes
      };
    } catch (error) {
      console.error('トークンデータの変換中にエラーが発生しました:', error);
      throw error;
    }
  }
  
  /**
   * エンティティをDBの行に変換
   */
  protected mapEntityToRow(entity: Token): Record<string, any> {
    try {
      // サーバIDsとスコープをJSON文字列に変換
      const serverIdsJson = JSON.stringify(entity.serverIds || []);
      const scopesJson = JSON.stringify(entity.scopes || []);
      
      // DB行オブジェクトを構築
      return {
        id: entity.id,
        client_id: entity.clientId,
        issued_at: entity.issuedAt,
        server_ids: serverIdsJson,
        scopes: scopesJson
      };
    } catch (error) {
      console.error('トークンデータの変換中にエラーが発生しました:', error);
      throw error;
    }
  }
  
  /**
   * トークンを取得
   */
  public getToken(id: string): Token | null {
    const token = this.getById(id);
    return token || null;
  }
  
  /**
   * トークンを保存
   */
  public saveToken(token: Token): void {
    const existingToken = this.getById(token.id);
    
    if (existingToken) {
      this.update(token.id, token);
    } else {
      this.add(token);
    }
  }
  
  /**
   * トークンをリスト表示
   */
  public listTokens(): Token[] {
    return this.getAll();
  }
  
  /**
   * トークンを削除
   */
  public deleteToken(id: string): boolean {
    return this.delete(id);
  }
  
  /**
   * クライアントIDに関連付けられた全てのトークンを削除
   */
  public deleteClientTokens(clientId: string): number {
    try {
      const sql = `DELETE FROM ${this.tableName} WHERE client_id = :clientId`;
      const result = this.db.prepare(sql).run({ clientId });
      return result.changes;
    } catch (error) {
      console.error(`クライアント${clientId}のトークン削除中にエラーが発生しました:`, error);
      throw error;
    }
  }
  
  /**
   * トークンのサーバIDsを更新
   */
  public updateTokenServerIds(id: string, serverIds: string[]): boolean {
    const token = this.getById(id);
    
    if (!token) {
      return false;
    }
    
    token.serverIds = serverIds;
    this.update(id, token);
    return true;
  }
  
  /**
   * トークンのスコープを更新
   */
  public updateTokenScopes(id: string, scopes: TokenScope[]): boolean {
    const token = this.getById(id);
    
    if (!token) {
      return false;
    }
    
    token.scopes = scopes;
    this.update(id, token);
    return true;
  }
  
  /**
   * クライアントIDに関連付けられたトークンを取得
   */
  public getTokensByClientId(clientId: string): Token[] {
    try {
      const sql = `SELECT * FROM ${this.tableName} WHERE client_id = :clientId`;
      const rows = this.db.all<any>(sql, { clientId });
      
      return rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      console.error(`クライアントID ${clientId} のトークン取得中にエラーが発生しました:`, error);
      throw error;
    }
  }
}

/**
 * TokenRepositoryのシングルトンインスタンスを取得
 */
let instance: TokenRepository | null = null;

export function getTokenRepository(): TokenRepository {
  if (!instance) {
    // SqliteManagerのインスタンスを取得
    const db = getSqliteManager('mcprouter');
    instance = new TokenRepository(db);
  }
  return instance;
}
