/**
 * Activity log type definitions
 * Types for visualizing ToolDiscovery/ToolExecute logs
 */

/**
 * Heatmap cell data
 */
export interface HeatmapCell {
  date: string; // YYYY-MM-DD
  hour: number; // 0-23
  count: number; // Activity count
}

/**
 * Heatmap data
 */
export interface HeatmapData {
  cells: HeatmapCell[];
  maxCount: number;
}

/**
 * Word cloud item data
 */
export interface WordCloudItem {
  text: string;
  value: number; // Occurrence frequency
}

/**
 * Activity log entry type
 */
export type ActivityType =
  | "ToolDiscovery"
  | "ToolExecute"
  | "CallTool" // Direct tool call
  | "GetPrompt" // Prompt retrieval
  | "ReadResource"; // Resource read

/**
 * Activity log entry
 */
export interface ActivityLogEntry {
  id: string;
  timestamp: number;
  clientId: string;
  clientName: string;
  type: ActivityType;
  // For ToolDiscovery
  query?: string[];
  context?: string;
  discoveredTools?: {
    toolKey: string;
    toolName: string;
    serverName: string;
    relevance: number;
  }[];
  // For ToolExecute
  toolKey?: string;
  toolName?: string;
  serverName?: string;
  arguments?: Record<string, unknown>;
  // Common fields
  status: "success" | "error";
  duration: number;
  errorMessage?: string;
  // Response data
  responseData?: unknown;

  // For GetPrompt
  promptName?: string;

  // For ReadResource
  resourceUri?: string;
}

/**
 * Daily activity summary
 */
export interface DailyActivitySummary {
  date: string; // YYYY-MM-DD
  totalCount: number;
  discoveryCount: number;
  executeCount: number;
  successCount: number;
  errorCount: number;
  topQueries: WordCloudItem[];
}

/**
 * Session grouping a ToolDiscovery with subsequent ToolExecute calls
 */
export interface ActivitySession {
  id: string;
  timestamp: number; // Session start time (time of ToolDiscovery)
  clientId: string;
  clientName: string;
  // ToolDiscovery info
  discovery: ActivityLogEntry;
  // Related ToolExecute calls (executions of discovered tools)
  executions: ActivityLogEntry[];
}

/**
 * Session or standalone ToolExecute
 */
export type ActivityItem =
  | { type: "session"; session: ActivitySession }
  | { type: "standalone"; entry: ActivityLogEntry };
