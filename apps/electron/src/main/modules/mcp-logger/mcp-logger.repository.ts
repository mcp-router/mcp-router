import { BaseRepository } from "../../infrastructure/database/base-repository";
import {
  SqliteManager,
  getSqliteManager,
} from "../../infrastructure/database/sqlite-manager";
import {
  RequestLogEntry,
  RequestLogEntryInput,
  RequestLogQueryOptions,
  RequestLogQueryResult,
} from "@mcp_router/shared";
import { encodeCursor, decodeCursor } from "@/renderer/utils/cursor";

/**
 * リクエストログ用リポジトリクラス
 * BetterSQLite3を使用してリクエストログを管理
 */
export class McpLoggerRepository extends BaseRepository<RequestLogEntry> {
  private static instance: McpLoggerRepository | null = null;
  /**
   * テーブル作成SQL
   */
  private static readonly CREATE_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS requestLogs (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      client_id TEXT NOT NULL,
      client_name TEXT NOT NULL,
      server_id TEXT NOT NULL,
      server_name TEXT NOT NULL,
      request_type TEXT NOT NULL,
      request_params TEXT,
      response_data TEXT,
      response_status TEXT NOT NULL,
      duration INTEGER NOT NULL,
      error_message TEXT
    )
  `;

  /**
   * インデックス作成SQL
   */
  private static readonly INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON requestLogs(timestamp)",
    "CREATE INDEX IF NOT EXISTS idx_request_logs_client_id ON requestLogs(client_id)",
    "CREATE INDEX IF NOT EXISTS idx_request_logs_server_id ON requestLogs(server_id)",
    "CREATE INDEX IF NOT EXISTS idx_request_logs_request_type ON requestLogs(request_type)",
    "CREATE INDEX IF NOT EXISTS idx_request_logs_response_status ON requestLogs(response_status)",
  ];

  /**
   * コンストラクタ
   * @param db SqliteManagerインスタンス
   */
  private constructor(db: SqliteManager) {
    super(db, "requestLogs");
    console.log(
      "[LogRepository] Constructor called with database:",
      db?.getDbPath?.() || "database instance",
    );
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): McpLoggerRepository {
    const db = getSqliteManager();
    if (!McpLoggerRepository.instance || McpLoggerRepository.instance.db !== db) {
      McpLoggerRepository.instance = new McpLoggerRepository(db);
    }
    return McpLoggerRepository.instance;
  }

  /**
   * インスタンスをリセット
   */
  public static resetInstance(): void {
    McpLoggerRepository.instance = null;
  }

  /**
   * テーブルを初期化（BaseRepositoryの抽象メソッドを実装）
   */
  protected initializeTable(): void {
    try {
      // テーブルを作成
      this.db.execute(McpLoggerRepository.CREATE_TABLE_SQL);

      // インデックスを作成
      McpLoggerRepository.INDEXES.forEach((indexSQL) => {
        this.db.execute(indexSQL);
      });

      console.log("[LogRepository] テーブルの初期化が完了しました");
    } catch (error) {
      console.error("[LogRepository] テーブルの初期化中にエラー:", error);
      throw error;
    }
  }

  /**
   * DBの行をエンティティに変換
   */
  protected mapRowToEntity(row: any): RequestLogEntry {
    try {
      // 直接JSONパースを行う（暗号化なし）
      let requestParams: any = undefined;
      if (row.request_params) {
        requestParams = JSON.parse(row.request_params);
      }

      let responseData: any = undefined;
      if (row.response_data) {
        responseData = JSON.parse(row.response_data);
      }

      const errorMessage: string | undefined = row.error_message;

      // エンティティオブジェクトを構築
      return {
        id: row.id,
        timestamp: row.timestamp,
        clientId: row.client_id,
        clientName: row.client_name,
        serverId: row.server_id,
        serverName: row.server_name,
        requestType: row.request_type,
        requestParams: requestParams,
        responseStatus: row.response_status,
        responseData: responseData,
        duration: row.duration,
        errorMessage: errorMessage,
      };
    } catch (error) {
      console.error("ログデータの変換中にエラーが発生しました:", error);
      throw error;
    }
  }

  /**
   * エンティティをDBの行に変換
   */
  protected mapEntityToRow(entity: RequestLogEntry): Record<string, any> {
    try {
      // JSONシリアライズのみを行う（暗号化なし）
      const requestParams = entity.requestParams
        ? JSON.stringify(entity.requestParams)
        : null;

      const responseData = entity.responseData
        ? JSON.stringify(entity.responseData)
        : null;

      const errorMessage = entity.errorMessage || null;

      // DB行オブジェクトを構築
      return {
        id: entity.id,
        timestamp: entity.timestamp,
        client_id: entity.clientId,
        client_name: entity.clientName,
        server_id: entity.serverId,
        server_name: entity.serverName,
        request_type: entity.requestType,
        request_params: requestParams,
        response_status: entity.responseStatus,
        response_data: responseData,
        duration: entity.duration,
        error_message: errorMessage,
      };
    } catch (error) {
      console.error("ログデータの変換中にエラーが発生しました:", error);
      throw error;
    }
  }

  /**
   * リクエストログを追加
   * @param entry 追加するログエントリ
   */
  public async addRequestLog(
    entry: RequestLogEntryInput,
  ): Promise<RequestLogEntry> {
    try {
      const timestamp = Date.now();

      // 完全なエントリを作成して追加
      const logEntry: RequestLogEntry = {
        ...entry,
        id: "", // BaseRepository#add()で自動生成される
        timestamp,
      };

      // リポジトリに追加
      const addedEntry = this.add(logEntry);

      return addedEntry;
    } catch (error) {
      console.error("リクエストログの追加中にエラーが発生しました:", error);
      throw error;
    }
  }

  /**
   * リクエストログを検索（カーソルベースページネーション、フィルタリング対応）
   */
  public async getRequestLogs(
    options: RequestLogQueryOptions = {},
  ): Promise<RequestLogQueryResult> {
    try {
      const {
        clientId,
        serverId,
        requestType,
        startDate,
        endDate,
        responseStatus,
        cursor,
        limit = 50,
      } = options;

      // SQLクエリとパラメータを構築
      let sql = `SELECT * FROM ${this.tableName} WHERE 1=1`;
      const params: any = {};

      // カーソルのデコード
      const cursorData = cursor ? decodeCursor(cursor) : null;
      const cursorTimestamp = cursorData?.timestamp || null;
      const cursorId = cursorData?.id || null;

      // カーソル条件を追加
      if (cursorTimestamp && cursorId) {
        sql +=
          " AND (timestamp < :cursorTimestamp OR (timestamp = :cursorTimestamp AND id < :cursorId))";
        params.cursorTimestamp = cursorTimestamp;
        params.cursorId = cursorId;
      }

      // フィルタリング条件を追加
      if (clientId) {
        sql += " AND client_id = :clientId";
        params.clientId = clientId;
      }

      if (serverId) {
        sql += " AND server_id = :serverId";
        params.serverId = serverId;
      }

      if (requestType) {
        sql += " AND request_type = :requestType";
        params.requestType = requestType;
      }

      if (responseStatus) {
        sql += " AND response_status = :responseStatus";
        params.responseStatus = responseStatus;
      }

      // 時間範囲フィルタリング
      if (startDate) {
        const startTime = startDate.getTime();
        sql += " AND timestamp >= :startTime";
        params.startTime = startTime;
      }

      if (endDate) {
        const endTime = new Date(
          endDate.getTime() + 24 * 60 * 60 * 1000 - 1,
        ).getTime(); // 終了日の23:59:59
        sql += " AND timestamp <= :endTime";
        params.endTime = endTime;
      }

      // 合計カウントクエリ（カーソル条件を除外）
      let countSql = sql.replace("SELECT *", "SELECT COUNT(*) as count");
      const countParams = { ...params };
      if (cursorTimestamp && cursorId) {
        // カーソル条件を除外してカウント
        countSql = countSql.replace(
          / AND \(timestamp < :cursorTimestamp OR \(timestamp = :cursorTimestamp AND id < :cursorId\)\)/,
          "",
        );
        delete countParams.cursorTimestamp;
        delete countParams.cursorId;
      }
      const countResult = this.db.get<{ count: number }>(countSql, countParams);
      const total = countResult?.count || 0;

      // メインクエリにソートとリミットを追加（+1 でhasMoreを判定）
      sql += " ORDER BY timestamp DESC, id DESC LIMIT :limit";
      params.limit = limit + 1;

      // クエリ実行
      const rows = this.db.all<any>(sql, params);

      // hasMoreの判定
      const hasMore = rows.length > limit;
      if (hasMore) {
        rows.pop(); // 余分な1件を削除
      }

      // 結果をエンティティに変換
      const logs = rows.map((row) => this.mapRowToEntity(row));

      // 次のカーソルを生成
      let nextCursor: string | undefined;
      if (hasMore && logs.length > 0) {
        const lastLog = logs[logs.length - 1];
        nextCursor = encodeCursor({
          timestamp: lastLog.timestamp,
          id: lastLog.id,
        });
      }

      return { items: logs, logs, total, nextCursor, hasMore };
    } catch (error) {
      console.error("リクエストログの取得中にエラーが発生しました:", error);
      return { items: [], logs: [], total: 0, hasMore: false };
    }
  }
}
