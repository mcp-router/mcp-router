/**
 * Request log type definitions
 */

import { CursorPaginationOptions, CursorPaginationResult } from "./pagination";

/**
 * Request log entry interface
 */
export interface RequestLogEntry {
  id: string; // Unique ID
  timestamp: number; // UNIX timestamp
  clientId: string; // Client identifier
  clientName: string; // Client name
  serverId: string; // Server identifier
  serverName: string; // Server name
  requestType: string; // Request type (CallTool, ReadResource, etc.)
  requestParams: any; // Request parameters
  responseStatus: "success" | "error"; // Response status
  responseData?: any; // Response data
  duration: number; // Processing time (ms)
  errorMessage?: string; // Error message (if any)
}

/**
 * Input interface for creating a new request log entry (id and timestamp are auto-generated)
 */
export type RequestLogEntryInput = Omit<RequestLogEntry, "id" | "timestamp">;

/**
 * Filter options for request log queries
 */
export interface RequestLogFilters {
  clientId?: string;
  serverId?: string;
  requestType?: string;
  startDate?: Date;
  endDate?: Date;
  responseStatus?: "success" | "error";
}

/**
 * Options for request log queries
 */
export interface RequestLogQueryOptions
  extends RequestLogFilters, CursorPaginationOptions {}

/**
 * Result of request log queries
 */
export interface RequestLogQueryResult extends CursorPaginationResult<RequestLogEntry> {
  logs: RequestLogEntry[]; // Kept for backward compatibility
}

/**
 * Simplified request log entry for MCP Manager
 */
export interface McpManagerRequestLogEntry {
  timestamp: string;
  requestType: string;
  params: any;
  result: "success" | "error";
  errorMessage?: string;
  response?: any;
  duration: number;
  clientId: string;
}

/**
 * MCP Aggregator server constants
 */
export const AGGREGATOR_SERVER_ID = "mcp-router-aggregator";
export const AGGREGATOR_SERVER_NAME = "MCP Router Aggregator";
