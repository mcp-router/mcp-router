import { SingletonService } from "../../core/singleton-service";
import {
  RequestLogEntry,
  RequestLogEntryInput,
  RequestLogQueryOptions,
  RequestLogQueryResult,
} from "@mcp_router/shared";
import { getLogRepository } from "../../../infrastructure/database";

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
    return (this as any).getInstanceBase();
  }

  /**
   * Reset instance
   * Used when switching workspaces
   */
  public static resetInstance(): void {
    (this as any).resetInstanceBase(LogService);
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
   * リクエストログを取得（カーソルベースページネーション、フィルタリング対応）
   */
  public async getRequestLogs(
    options: RequestLogQueryOptions = {},
  ): Promise<RequestLogQueryResult> {
    try {
      return await getLogRepository().getRequestLogs(options);
    } catch (error) {
      return this.handleError("取得", error, {
        logs: [],
        total: 0,
        hasMore: false,
      });
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
