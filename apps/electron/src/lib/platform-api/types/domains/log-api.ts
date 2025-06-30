/**
 * Log management domain API
 */

export interface LogQueryOptions {
  clientId?: string;
  serverId?: string;
  requestType?: string;
  startDate?: Date;
  endDate?: Date;
  responseStatus?: "success" | "error";
  offset?: number;
  limit?: number;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  clientId: string;
  serverId: string;
  requestType: string;
  responseStatus: "success" | "error";
  duration?: number;
  error?: string;
  details?: any;
}

export interface LogQueryResult {
  logs: LogEntry[];
  total: number;
}

export interface LogAPI {
  query(options?: LogQueryOptions): Promise<LogQueryResult>;
}
