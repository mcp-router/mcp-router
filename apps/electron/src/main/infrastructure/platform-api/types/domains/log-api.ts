/**
 * Log management domain API
 */

import {
  CursorPaginationOptions,
  CursorPaginationResult,
} from "@mcp_router/shared";

/**
 * Platform API用のログフィルター
 */
interface LogFilters {
  clientId?: string;
  serverId?: string;
  requestType?: string;
  startDate?: Date;
  endDate?: Date;
  responseStatus?: "success" | "error";
}

/**
 * Platform API用のログクエリオプション
 */
export interface LogQueryOptions extends LogFilters, CursorPaginationOptions {}

export interface LogEntry {
  id: string;
  timestamp: Date | number;
  clientId: string;
  clientName: string;
  serverId: string;
  serverName: string;
  requestType: string;
  requestParams?: any;
  responseStatus: "success" | "error";
  responseData?: any;
  duration?: number;
  errorMessage?: string;
}

/**
 * Platform API用のログクエリ結果
 */
export interface LogQueryResult extends CursorPaginationResult<LogEntry> {
  logs: LogEntry[]; // 互換性のため残す
}

export interface LogAPI {
  query(options?: LogQueryOptions): Promise<LogQueryResult>;
}
