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
 * Log filters for Platform API
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
 * Log query options for Platform API
 */
export interface LogQueryOptions extends LogFilters, CursorPaginationOptions {}

/**
 * Log query result for Platform API
 */
export interface LogQueryResult extends CursorPaginationResult<LogEntry> {
  logs: LogEntry[]; // Kept for backward compatibility
}

export interface LogAPI {
  query(options?: LogQueryOptions): Promise<LogQueryResult>;
}
