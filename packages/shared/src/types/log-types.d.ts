/**
 * リクエストログ関連の型定義
 */
/**
 * リクエストログエントリのインターフェース
 */
export interface RequestLogEntry {
    id: string;
    timestamp: number;
    clientId: string;
    clientName: string;
    serverId: string;
    serverName: string;
    requestType: string;
    requestParams: any;
    responseStatus: "success" | "error";
    responseData?: any;
    duration: number;
    errorMessage?: string;
}
/**
 * リクエストログ新規作成時の入力インターフェース（idとtimestampは自動生成）
 */
export type RequestLogEntryInput = Omit<RequestLogEntry, "id" | "timestamp">;
/**
 * 時系列データポイントのインターフェース
 */
export interface TimeSeriesDataPoint {
    timestamp: number;
    timeBucket: string;
    requestType: string;
    count: number;
    clientId: string;
    clientName?: string;
    serverId?: string;
    serverName?: string;
}
/**
 * リクエストログクエリのオプション
 */
export interface RequestLogQueryOptions {
    clientId?: string;
    serverId?: string;
    requestType?: string;
    startDate?: Date;
    endDate?: Date;
    responseStatus?: "success" | "error";
    offset?: number;
    limit?: number;
}
/**
 * クライアント統計情報
 */
export interface ClientStats {
    clientId: string;
    clientName: string;
    requestCount: number;
}
/**
 * サーバ統計情報
 */
export interface ServerStats {
    serverId: string;
    serverName: string;
    requestCount: number;
}
/**
 * リクエストタイプ統計情報
 */
export interface RequestTypeStats {
    requestType: string;
    count: number;
}
//# sourceMappingURL=log-types.d.ts.map