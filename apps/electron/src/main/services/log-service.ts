import { SingletonService } from "./singleton-service";
import {
  RequestLogEntry,
  RequestLogEntryInput,
  RequestLogQueryOptions,
  ClientStats,
  ServerStats,
  RequestTypeStats,
} from "@mcp-router/shared";
import { getLogRepository } from "../../lib/database";

/**
 * Request log service class
 */
export class LogService extends SingletonService<
  RequestLogEntry,
  string,
  LogService
> {
  /**
   * Constructor
   */
  protected constructor() {
    super();
  }

  /**
   * Get entity name
   */
  protected getEntityName(): string {
    return "Request Log";
  }

  /**
   * Get singleton instance of LogService
   */
  public static getInstance(): LogService {
    return this.getInstanceBase();
  }

  /**
   * Reset instance
   * Used when switching workspaces
   */
  public static resetInstance(): void {
    this.resetInstanceBase(LogService);
  }

  //--------------------------------------------------------------------------------
  // リクエストログ関連メソッド
  //--------------------------------------------------------------------------------

  /**
   * リクエストログを追加
   */
  public async addRequestLog(
    entry: RequestLogEntryInput,
  ): Promise<RequestLogEntry> {
    try {
      return await getLogRepository().addRequestLog(entry);
    } catch (error) {
      return this.handleError("追加", error);
    }
  }

  /**
   * リクエストログを取得（ページネーション、フィルタリング対応）
   */
  public async getRequestLogs(
    options: RequestLogQueryOptions = {},
  ): Promise<{ logs: RequestLogEntry[]; total: number }> {
    try {
      return await getLogRepository().getRequestLogs(options);
    } catch (error) {
      return this.handleError("取得", error, { logs: [], total: 0 });
    }
  }

  /**
   * 利用可能なクライアントIDのリストを取得
   */
  public getAvailableClientIds(): string[] {
    try {
      return getLogRepository().getAvailableClientIds();
    } catch (error) {
      return this.handleError("クライアントIDリストの取得", error, []);
    }
  }

  /**
   * リクエストタイプのリストを取得
   */
  public getAvailableRequestTypes(): string[] {
    try {
      return getLogRepository().getAvailableRequestTypes();
    } catch (error) {
      return this.handleError("リクエストタイプリストの取得", error, []);
    }
  }

  /**
   * クライアント別リクエスト統計情報を取得
   */
  public getClientStats(): ClientStats[] {
    try {
      return getLogRepository().getClientStats();
    } catch (error) {
      return this.handleError("クライアント統計情報の取得", error, []);
    }
  }

  /**
   * サーバ別リクエスト統計情報を取得
   */
  public getServerStats(): ServerStats[] {
    try {
      return getLogRepository().getServerStats();
    } catch (error) {
      return this.handleError("サーバ統計情報の取得", error, []);
    }
  }

  /**
   * リクエストタイプ別統計情報を取得
   */
  public getRequestTypeStats(): RequestTypeStats[] {
    try {
      return getLogRepository().getRequestTypeStats();
    } catch (error) {
      return this.handleError("リクエストタイプ統計情報の取得", error, []);
    }
  }

  /**
   * クライアントIDから名前を取得
   */
  public getClientNameById(clientId: string): string {
    try {
      return getLogRepository().getClientNameById(clientId);
    } catch (error) {
      return this.handleError(
        "クライアント名の取得",
        error,
        `client-${clientId.substring(0, 8)}`,
      );
    }
  }

  /**
   * IDでログエントリを取得
   * @param id ログエントリのID
   * @returns 見つかった場合はログエントリ、見つからない場合はundefined
   */
  public getLogById(id: string): RequestLogEntry | undefined {
    try {
      return getLogRepository().getById(id);
    } catch (error) {
      return this.handleError("ID検索", error, undefined);
    }
  }
}

/**
 * LogServiceのシングルトンインスタンスを取得
 */
export function getLogService(): LogService {
  return LogService.getInstance();
}

// アプリケーション起動時にインスタンスを初期化
export const logService = LogService.getInstance();
