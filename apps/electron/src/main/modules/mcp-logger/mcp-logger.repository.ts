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
 * Repository class for request logs.
 * Manages request logs using BetterSQLite3.
 */
export class McpLoggerRepository extends BaseRepository<RequestLogEntry> {
  private static instance: McpLoggerRepository | null = null;
  /**
   * Table creation SQL
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
   * Index creation SQL
   */
  private static readonly INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON requestLogs(timestamp)",
    "CREATE INDEX IF NOT EXISTS idx_request_logs_client_id ON requestLogs(client_id)",
    "CREATE INDEX IF NOT EXISTS idx_request_logs_server_id ON requestLogs(server_id)",
    "CREATE INDEX IF NOT EXISTS idx_request_logs_request_type ON requestLogs(request_type)",
    "CREATE INDEX IF NOT EXISTS idx_request_logs_response_status ON requestLogs(response_status)",
  ];

  /**
   * Constructor
   * @param db SqliteManager instance
   */
  private constructor(db: SqliteManager) {
    super(db, "requestLogs");
    console.log(
      "[LogRepository] Constructor called with database:",
      db?.getDbPath?.() || "database instance",
    );
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): McpLoggerRepository {
    const db = getSqliteManager();
    if (
      !McpLoggerRepository.instance ||
      McpLoggerRepository.instance.db !== db
    ) {
      McpLoggerRepository.instance = new McpLoggerRepository(db);
    }
    return McpLoggerRepository.instance;
  }

  /**
   * Reset the instance
   */
  public static resetInstance(): void {
    McpLoggerRepository.instance = null;
  }

  /**
   * Initialize the table (implements BaseRepository abstract method)
   */
  protected initializeTable(): void {
    try {
      // Create table
      this.db.execute(McpLoggerRepository.CREATE_TABLE_SQL);

      // Create indexes
      McpLoggerRepository.INDEXES.forEach((indexSQL) => {
        this.db.execute(indexSQL);
      });

      console.log("[LogRepository] Table initialization completed");
    } catch (error) {
      console.error("[LogRepository] Error initializing table:", error);
      throw error;
    }
  }

  /**
   * Convert a database row to an entity
   */
  protected mapRowToEntity(row: any): RequestLogEntry {
    try {
      // Parse JSON directly (no encryption)
      let requestParams: any = undefined;
      if (row.request_params) {
        requestParams = JSON.parse(row.request_params);
      }

      let responseData: any = undefined;
      if (row.response_data) {
        responseData = JSON.parse(row.response_data);
      }

      const errorMessage: string | undefined = row.error_message;

      // Build entity object
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
      console.error("Error converting log data (mapRowToEntity):", error);
      throw error;
    }
  }

  /**
   * Convert an entity to a database row
   */
  protected mapEntityToRow(entity: RequestLogEntry): Record<string, any> {
    try {
      // JSON serialize only (no encryption)
      const requestParams = entity.requestParams
        ? JSON.stringify(entity.requestParams)
        : null;

      const responseData = entity.responseData
        ? JSON.stringify(entity.responseData)
        : null;

      const errorMessage = entity.errorMessage || null;

      // Build database row object
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
      console.error("Error converting log data (mapEntityToRow):", error);
      throw error;
    }
  }

  /**
   * Add a request log entry
   * @param entry Log entry to add
   */
  public async addRequestLog(
    entry: RequestLogEntryInput,
  ): Promise<RequestLogEntry> {
    try {
      const timestamp = Date.now();

      // Create complete entry and add
      const logEntry: RequestLogEntry = {
        ...entry,
        id: "", // Auto-generated by BaseRepository#add()
        timestamp,
      };

      // Add to repository
      const addedEntry = this.add(logEntry);

      return addedEntry;
    } catch (error) {
      console.error("Error adding request log:", error);
      throw error;
    }
  }

  /**
   * Search request logs (cursor-based pagination with filtering)
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

      // Build SQL query and parameters
      let sql = `SELECT * FROM ${this.tableName} WHERE 1=1`;
      const params: any = {};

      // Decode cursor
      const cursorData = cursor ? decodeCursor(cursor) : null;
      const cursorTimestamp = cursorData?.timestamp || null;
      const cursorId = cursorData?.id || null;

      // Add cursor conditions
      if (cursorTimestamp && cursorId) {
        sql +=
          " AND (timestamp < :cursorTimestamp OR (timestamp = :cursorTimestamp AND id < :cursorId))";
        params.cursorTimestamp = cursorTimestamp;
        params.cursorId = cursorId;
      }

      // Add filtering conditions
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

      // Time range filtering
      if (startDate) {
        const startTime = startDate.getTime();
        sql += " AND timestamp >= :startTime";
        params.startTime = startTime;
      }

      if (endDate) {
        const endTime = new Date(
          endDate.getTime() + 24 * 60 * 60 * 1000 - 1,
        ).getTime(); // End of day 23:59:59
        sql += " AND timestamp <= :endTime";
        params.endTime = endTime;
      }

      // Total count query (excluding cursor conditions)
      let countSql = sql.replace("SELECT *", "SELECT COUNT(*) as count");
      const countParams = { ...params };
      if (cursorTimestamp && cursorId) {
        // Remove cursor conditions for count
        countSql = countSql.replace(
          / AND \(timestamp < :cursorTimestamp OR \(timestamp = :cursorTimestamp AND id < :cursorId\)\)/,
          "",
        );
        delete countParams.cursorTimestamp;
        delete countParams.cursorId;
      }
      const countResult = this.db.get<{ count: number }>(countSql, countParams);
      const total = countResult?.count || 0;

      // Add sort and limit to main query (+1 to determine hasMore)
      sql += " ORDER BY timestamp DESC, id DESC LIMIT :limit";
      params.limit = limit + 1;

      // Execute query
      const rows = this.db.all<any>(sql, params);

      // Determine hasMore
      const hasMore = rows.length > limit;
      if (hasMore) {
        rows.pop(); // Remove the extra row
      }

      // Convert results to entities
      const logs = rows.map((row) => this.mapRowToEntity(row));

      // Generate next cursor
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
      console.error("Error retrieving request logs:", error);
      return { items: [], logs: [], total: 0, hasMore: false };
    }
  }
}
