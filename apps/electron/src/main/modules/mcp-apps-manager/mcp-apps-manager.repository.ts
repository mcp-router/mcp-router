import { BaseRepository } from "../../infrastructure/database/base-repository";
import {
  SqliteManager,
  getSqliteManager,
} from "../../infrastructure/database/sqlite-manager";
import { Token } from "@mcp_router/shared";

/**
 * トークン用リポジトリクラス
 * BetterSQLite3を使用してトークンを管理
 */
export class McpAppsManagerRepository extends BaseRepository<Token> {
  private static instance: McpAppsManagerRepository | null = null;
  /**
   * テーブル作成SQL
   */
  private static readonly CREATE_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS tokens (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      issued_at INTEGER NOT NULL,
      server_ids TEXT NOT NULL
    )
  `;

  /**
   * インデックス作成SQL
   */
  private static readonly INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_tokens_client_id ON tokens(client_id)",
  ];

  /**
   * コンストラクタ
   * @param db SqliteManagerインスタンス
   */
  private constructor(db: SqliteManager) {
    super(db, "tokens");
    console.log(
      "[TokenRepository] Constructor called with database:",
      db?.getDbPath?.() || "database instance",
    );
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): McpAppsManagerRepository {
    const db = getSqliteManager();
    if (
      !McpAppsManagerRepository.instance ||
      McpAppsManagerRepository.instance.db !== db
    ) {
      McpAppsManagerRepository.instance = new McpAppsManagerRepository(db);
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
   * テーブルを初期化（BaseRepositoryの抽象メソッドを実装）
   */
  protected initializeTable(): void {
    try {
      // テーブルを作成
      this.db.execute(McpAppsManagerRepository.CREATE_TABLE_SQL);

      // インデックスを作成
      McpAppsManagerRepository.INDEXES.forEach((indexSQL) => {
        this.db.execute(indexSQL);
      });

      console.log("[TokenRepository] テーブルの初期化が完了しました");
    } catch (error) {
      console.error("[TokenRepository] テーブルの初期化中にエラー:", error);
      throw error;
    }
  }

  /**
   * DBの行をエンティティに変換
   */
  protected mapRowToEntity(row: any): Token {
    try {
      // サーバIDsをJSONからパース
      const serverIds = JSON.parse(row.server_ids);

      // エンティティオブジェクトを構築
      return {
        id: row.id,
        clientId: row.client_id,
        issuedAt: row.issued_at,
        serverIds: serverIds,
      };
    } catch (error) {
      console.error("トークンデータの変換中にエラーが発生しました:", error);
      throw error;
    }
  }

  /**
   * エンティティをDBの行に変換
   */
  protected mapEntityToRow(entity: Token): Record<string, any> {
    try {
      // サーバIDsをJSON文字列に変換
      const serverIdsJson = JSON.stringify(entity.serverIds || []);

      // DB行オブジェクトを構築
      return {
        id: entity.id,
        client_id: entity.clientId,
        issued_at: entity.issuedAt,
        server_ids: serverIdsJson,
      };
    } catch (error) {
      console.error("トークンデータの変換中にエラーが発生しました:", error);
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
    const token = this.getById(id);

    if (!token) {
      return false;
    }

    token.serverIds = serverIds;
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

      return rows.map((row) => this.mapRowToEntity(row));
    } catch (error) {
      console.error(
        `クライアントID ${clientId} のトークン取得中にエラーが発生しました:`,
        error,
      );
      throw error;
    }
  }
}
