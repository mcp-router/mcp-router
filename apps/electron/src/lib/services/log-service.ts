import { BaseService } from './base-service';
import { 
  RequestLogEntry,
  RequestLogEntryInput,
  RequestLogQueryOptions,
  ClientStats,
  ServerStats,
  RequestTypeStats
} from '../types/log-types';
import { Singleton } from '../utils/singleton';
import { LogRepository, getLogRepository } from '../database/log-repository';

/**
 * リクエストログサービスクラス
 */
export class LogService extends BaseService<RequestLogEntry, string> implements Singleton<LogService> {
  private static instance: LogService | null = null;
  private repository: LogRepository;
  
  /**
   * コンストラクタ
   */
  private constructor() {
    super();
    this.repository = getLogRepository();
  }
  
  
  /**
   * エンティティ名を取得
   */
  protected getEntityName(): string {
    return 'リクエストログ';
  }
  
  /**
   * LogServiceのシングルトンインスタンスを取得
   */
  public static getInstance(): LogService {
    if (!LogService.instance) {
      LogService.instance = new LogService();
    }
    return LogService.instance;
  }
  
  //--------------------------------------------------------------------------------
  // リクエストログ関連メソッド
  //--------------------------------------------------------------------------------
  
  /**
   * リクエストログを追加
   */
  public async addRequestLog(entry: RequestLogEntryInput): Promise<RequestLogEntry> {
    try {
      return await this.repository.addRequestLog(entry);
    } catch (error) {
      return this.handleError('追加', error);
    }
  }
  
  /**
   * リクエストログを取得（ページネーション、フィルタリング対応）
   */
  public async getRequestLogs(options: RequestLogQueryOptions = {}): Promise<{ logs: RequestLogEntry[]; total: number }> {
    try {
      return await this.repository.getRequestLogs(options);
    } catch (error) {
      return this.handleError('取得', error, { logs: [], total: 0 });
    }
  }

  /**
   * 利用可能なクライアントIDのリストを取得
   */
  public getAvailableClientIds(): string[] {
    try {
      return this.repository.getAvailableClientIds();
    } catch (error) {
      return this.handleError('クライアントIDリストの取得', error, []);
    }
  }
  
  /**
   * リクエストタイプのリストを取得
   */
  public getAvailableRequestTypes(): string[] {
    try {
      return this.repository.getAvailableRequestTypes();
    } catch (error) {
      return this.handleError('リクエストタイプリストの取得', error, []);
    }
  }
  
  /**
   * クライアント別リクエスト統計情報を取得
   */
  public getClientStats(): ClientStats[] {
    try {
      return this.repository.getClientStats();
    } catch (error) {
      return this.handleError('クライアント統計情報の取得', error, []);
    }
  }
  
  /**
   * サーバ別リクエスト統計情報を取得
   */
  public getServerStats(): ServerStats[] {
    try {
      return this.repository.getServerStats();
    } catch (error) {
      return this.handleError('サーバ統計情報の取得', error, []);
    }
  }
  
  /**
   * リクエストタイプ別統計情報を取得
   */
  public getRequestTypeStats(): RequestTypeStats[] {
    try {
      return this.repository.getRequestTypeStats();
    } catch (error) {
      return this.handleError('リクエストタイプ統計情報の取得', error, []);
    }
  }
  
  /**
   * クライアントIDから名前を取得
   */
  public getClientNameById(clientId: string): string {
    try {
      return this.repository.getClientNameById(clientId);
    } catch (error) {
      return this.handleError('クライアント名の取得', error, `client-${clientId.substring(0, 8)}`);
    }
  }
  
  /**
   * IDでログエントリを取得
   * @param id ログエントリのID
   * @returns 見つかった場合はログエントリ、見つからない場合はundefined
   */
  public getLogById(id: string): RequestLogEntry | undefined {
    try {
      return this.repository.getById(id);
    } catch (error) {
      return this.handleError('ID検索', error, undefined);
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
