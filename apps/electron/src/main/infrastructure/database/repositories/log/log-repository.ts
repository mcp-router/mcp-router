import { BaseRepository } from "../../core/base-repository";
import { SqliteManager } from "../../core/sqlite-manager";
import {
  RequestLogEntry,
  RequestLogEntryInput,
  RequestLogQueryOptions,
  RequestLogQueryResult,
  ClientStats,
  ServerStats,
  RequestTypeStats,
} from "@mcp_router/shared";
import { encodeCursor, decodeCursor } from "@/renderer/utils/cursor";

/**
 * リクエストログ用リポジトリクラス
 * BetterSQLite3を使用してリクエストログを管理
 */
export class LogRepository extends BaseRepository<RequestLogEntry> {
  private clientNameCache: Map<string, string> = new Map();

  /**
   * コンストラクタ
   * @param db SqliteManagerインスタンス
   */
  constructor(db: SqliteManager) {
    super(db, "requestLogs");
    console.log(
      "[LogRepository] Constructor called with database:",
      db?.getDbPath?.() || "database instance",
    );
  }

  /**
   * テーブルを初期化（BaseRepositoryの抽象メソッドを実装）
   * 注: スキーマのマイグレーションはDatabaseMigrationクラスで一元管理されます
   */
  protected initializeTable(): void {
    // 初期化処理はDatabaseMigrationで行うため、ここでは何もしない
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

      // メタデータを更新
      this.updateMetadata(entry);

      return addedEntry;
    } catch (error) {
      console.error("リクエストログの追加中にエラーが発生しました:", error);
      throw error;
    }
  }

  /**
   * メタデータを更新
   */
  private updateMetadata(entry: RequestLogEntryInput): void {
    try {
      this.db.transaction(() => {
        // クライアントIDのメタデータ更新
        this.updateMetadataArray("client_ids", entry.clientId);

        // サーバIDのメタデータ更新
        this.updateMetadataArray("server_ids", entry.serverId);

        // リクエストタイプのメタデータ更新
        this.updateMetadataArray("request_types", entry.requestType);
      });
    } catch (error) {
      console.error("メタデータの更新中にエラーが発生しました:", error);
      // メタデータ更新の失敗はログに記録するが、例外はスローしない（ログ機能自体の動作を妨げないため）
    }
  }

  /**
   * メタデータ配列を更新（存在しない値がある場合のみ追加）
   */
  private updateMetadataArray(key: string, value: string): void {
    // 現在の値を取得
    const metadataRow = this.db.get<{ value: string }>(
      "SELECT value FROM logs_metadata WHERE key = :key",
      { key },
    );
    if (!metadataRow) {
      throw new Error(`メタデータキー '${key}' が見つかりません`);
    }

    // JSON配列にパース
    const values = JSON.parse(metadataRow.value) as string[];

    // 値が存在しない場合のみ追加
    if (!values.includes(value)) {
      values.push(value);

      // 更新
      this.db.execute(
        "UPDATE logs_metadata SET value = :value WHERE key = :key",
        { key, value: JSON.stringify(values) },
      );
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

  /**
   * 利用可能なクライアントIDのリストを取得
   */
  public getAvailableClientIds(): string[] {
    try {
      const metadata = this.db.get<{ value: string }>(
        "SELECT value FROM logs_metadata WHERE key = :key",
        { key: "client_ids" },
      );
      return metadata ? JSON.parse(metadata.value) : [];
    } catch (error) {
      console.error(
        "クライアントIDリストの取得中にエラーが発生しました:",
        error,
      );
      return [];
    }
  }

  /**
   * リクエストタイプのリストを取得
   */
  public getAvailableRequestTypes(): string[] {
    try {
      const metadata = this.db.get<{ value: string }>(
        "SELECT value FROM logs_metadata WHERE key = :key",
        { key: "request_types" },
      );
      return metadata ? JSON.parse(metadata.value) : [];
    } catch (error) {
      console.error(
        "リクエストタイプリストの取得中にエラーが発生しました:",
        error,
      );
      return [];
    }
  }

  /**
   * クライアント別リクエスト統計情報を取得
   */
  public getClientStats(): ClientStats[] {
    try {
      const sql = `
        SELECT client_id, client_name, COUNT(*) as request_count
        FROM ${this.tableName}
        GROUP BY client_id
        ORDER BY request_count DESC
      `;

      const rows = this.db.all<{
        client_id: string;
        client_name: string;
        request_count: number;
      }>(sql);

      return rows.map((row) => ({
        clientId: row.client_id,
        clientName: row.client_name,
        requestCount: row.request_count,
      }));
    } catch (error) {
      console.error(
        "クライアント統計情報の取得中にエラーが発生しました:",
        error,
      );
      return [];
    }
  }

  /**
   * サーバ別リクエスト統計情報を取得
   */
  public getServerStats(): ServerStats[] {
    try {
      const sql = `
        SELECT server_id, server_name, COUNT(*) as request_count
        FROM ${this.tableName}
        GROUP BY server_id
        ORDER BY request_count DESC
      `;

      const rows = this.db.all<{
        server_id: string;
        server_name: string;
        request_count: number;
      }>(sql);

      return rows.map((row) => ({
        serverId: row.server_id,
        serverName: row.server_name,
        requestCount: row.request_count,
      }));
    } catch (error) {
      console.error("サーバ統計情報の取得中にエラーが発生しました:", error);
      return [];
    }
  }

  /**
   * リクエストタイプ別統計情報を取得
   */
  public getRequestTypeStats(): RequestTypeStats[] {
    try {
      const sql = `
        SELECT request_type, COUNT(*) as count
        FROM ${this.tableName}
        GROUP BY request_type
        ORDER BY count DESC
      `;

      const rows = this.db.all<{ request_type: string; count: number }>(sql);

      return rows.map((row) => ({
        requestType: row.request_type,
        count: row.count,
      }));
    } catch (error) {
      console.error(
        "リクエストタイプ統計情報の取得中にエラーが発生しました:",
        error,
      );
      return [];
    }
  }

  /**
   * クライアントIDから名前を取得
   */
  public getClientNameById(clientId: string): string {
    // キャッシュにある場合はそれを返す
    if (this.clientNameCache.has(clientId)) {
      return this.clientNameCache.get(clientId)!;
    }

    try {
      // 最新のクライアント名を取得
      const sql = `
        SELECT client_name
        FROM ${this.tableName}
        WHERE client_id = :clientId AND client_name != 'unknown-client' AND client_name != ''
        ORDER BY timestamp DESC
        LIMIT 1
      `;

      const result = this.db.get<{ client_name: string }>(sql, { clientId });

      let clientName: string;
      if (result && result.client_name) {
        clientName = result.client_name;
      } else {
        // クライアントIDから短縮名を生成
        clientName = `client-${clientId.substring(0, Math.min(8, clientId.length))}`;
      }

      // キャッシュに保存
      this.clientNameCache.set(clientId, clientName);
      return clientName;
    } catch (error) {
      console.error("クライアント名の取得中にエラーが発生しました:", error);
      return `client-${clientId.substring(0, Math.min(8, clientId.length))}`;
    }
  }
}
