/**
 * Log management domain API
 */

import type {
  CursorPaginationOptions,
  CursorPaginationResult,
} from "../../pagination";
import type { RequestLogEntry } from "../../log-types";

// Alias for API compatibility
export type LogEntry = RequestLogEntry;

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

/**
 * Platform API用のログクエリ結果
 */
export interface LogQueryResult extends CursorPaginationResult<LogEntry> {
  logs: LogEntry[]; // 互換性のため残す
}

export interface LogAPI {
  query(options?: LogQueryOptions): Promise<LogQueryResult>;
}
