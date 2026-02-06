import { useState, useEffect, useCallback, useMemo } from "react";
import {
  RequestLogEntry,
  HeatmapCell,
  HeatmapData,
  WordCloudItem,
  ActivityLogEntry,
  ActivityType,
  ActivitySession,
  ActivityItem,
} from "@mcp_router/shared";
import { usePlatformAPI } from "@/renderer/platform-api";

interface ActivityDataParams {
  /** Heatmap display period (in days) */
  heatmapDays?: number;
  /** Selected date (YYYY-MM-DD format) */
  selectedDate?: string;
  /** Refresh trigger */
  refreshTrigger?: number;
}

/** Session grouping configuration */
const SESSION_TIME_WINDOW_MS = 30 * 60 * 1000; // Group ToolExecute calls within 30 minutes

/** Request types displayed as activities */
const ACTIVITY_TYPES: ActivityType[] = [
  "ToolDiscovery",
  "ToolExecute",
  "CallTool",
  "GetPrompt",
  "ReadResource",
];

interface ActivityDataResult {
  /** Heatmap data */
  heatmapData: HeatmapData;
  /** Word cloud data for the selected date */
  wordCloudData: WordCloudItem[];
  /** Activity items for the selected date (sessions or standalone entries) */
  activityItems: ActivityItem[];
  /** Loading state */
  loading: boolean;
  /** Error */
  error: string | null;
  /** Refetch data */
  refetch: () => Promise<void>;
}

/**
 * Convert RequestLogEntry to ActivityLogEntry
 */
const toActivityLogEntry = (log: RequestLogEntry): ActivityLogEntry | null => {
  const type = log.requestType as ActivityType;
  if (!ACTIVITY_TYPES.includes(type)) {
    return null;
  }

  const base: ActivityLogEntry = {
    id: log.id,
    timestamp: log.timestamp,
    clientId: log.clientId,
    clientName: log.clientName,
    type,
    status: log.responseStatus,
    duration: log.duration,
    errorMessage: log.errorMessage,
  };

  if (type === "ToolDiscovery") {
    const params = log.requestParams || {};
    const response = log.responseData;

    // Extract discoveredTools from responseData
    let discoveredTools: ActivityLogEntry["discoveredTools"] = [];
    if (response?.content?.[0]?.text) {
      try {
        const parsed = JSON.parse(response.content[0].text);
        if (Array.isArray(parsed)) {
          discoveredTools = parsed.map((item: any) => ({
            toolKey: item.toolKey || "",
            toolName: item.toolName || "",
            serverName: item.serverName || "",
            relevance: item.relevance || 0,
          }));
        }
      } catch {
        // JSON parse error - ignore
      }
    }

    return {
      ...base,
      query: params.query || [],
      context: params.context,
      discoveredTools,
    };
  }

  if (type === "ToolExecute") {
    const params = log.requestParams || {};
    const toolKey = params.toolKey || "";
    const toolName = params.toolName || "";

    return {
      ...base,
      toolKey,
      toolName,
      serverName: log.serverName,
      arguments: params.arguments,
      responseData: log.responseData,
    };
  }

  // CallTool: direct tool invocation
  if (type === "CallTool") {
    const params = log.requestParams || {};
    const toolName = params.name || "";

    return {
      ...base,
      toolName,
      serverName: log.serverName,
      arguments: params.arguments,
      responseData: log.responseData,
    };
  }

  // GetPrompt: prompt retrieval
  if (type === "GetPrompt") {
    const params = log.requestParams || {};
    const promptName = params.name || "";

    return {
      ...base,
      promptName,
      serverName: log.serverName,
      arguments: params.arguments,
      responseData: log.responseData,
    };
  }

  // ReadResource: resource read
  if (type === "ReadResource") {
    const params = log.requestParams || {};
    const resourceUri = params.uri || "";

    return {
      ...base,
      resourceUri,
      serverName: log.serverName,
      responseData: log.responseData,
    };
  }

  return null;
};

/**
 * Get date string (YYYY-MM-DD format)
 */
const getDateString = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

/**
 * Get hour (0-23)
 */
const getHour = (timestamp: number): number => {
  return new Date(timestamp).getHours();
};

/**
 * Hook for fetching and processing activity (ToolDiscovery/ToolExecute) data
 */
export const useActivityData = (
  params: ActivityDataParams,
): ActivityDataResult => {
  const platformAPI = usePlatformAPI();
  const { heatmapDays = 30, selectedDate, refreshTrigger } = params;

  const [rawLogs, setRawLogs] = useState<RequestLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - heatmapDays);

      // Get all logs without requestType filter
      const result = await platformAPI.logs.query({
        startDate,
        endDate,
        limit: 1000,
      });

      // Filter for ActivityType targets on the client side
      const allLogs = (result.logs || [])
        .filter((log) =>
          ACTIVITY_TYPES.includes(log.requestType as ActivityType),
        )
        .sort((a, b) => b.timestamp - a.timestamp);

      setRawLogs(allLogs);
    } catch (err) {
      console.error("Failed to fetch activity data:", err);
      setError("Failed to fetch activity data");
      setRawLogs([]);
    } finally {
      setLoading(false);
    }
  }, [platformAPI, heatmapDays, refreshTrigger]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate heatmap data
  const heatmapData = useMemo((): HeatmapData => {
    const cellMap = new Map<string, number>();

    for (const log of rawLogs) {
      const dateStr = getDateString(log.timestamp);
      const hour = getHour(log.timestamp);
      const key = `${dateStr}-${hour}`;
      cellMap.set(key, (cellMap.get(key) || 0) + 1);
    }

    const cells: HeatmapCell[] = [];
    let maxCount = 0;

    for (const [key, count] of cellMap.entries()) {
      const [date, hourStr] = key.split("-").reduce(
        (acc, part, i) => {
          if (i < 3) {
            acc[0] = acc[0] ? `${acc[0]}-${part}` : part;
          } else {
            acc[1] = part;
          }
          return acc;
        },
        ["", ""],
      );

      const hour = parseInt(hourStr, 10);
      cells.push({ date, hour, count });
      maxCount = Math.max(maxCount, count);
    }

    return { cells, maxCount };
  }, [rawLogs]);

  // Calculate word cloud data for the selected date
  const wordCloudData = useMemo((): WordCloudItem[] => {
    if (!selectedDate) return [];

    const wordCount = new Map<string, number>();

    for (const log of rawLogs) {
      if (getDateString(log.timestamp) !== selectedDate) continue;
      if (log.requestType !== "ToolDiscovery") continue;

      const query = log.requestParams?.query;
      if (Array.isArray(query)) {
        for (const word of query) {
          if (typeof word === "string" && word.trim()) {
            const normalized = word.toLowerCase().trim();
            wordCount.set(normalized, (wordCount.get(normalized) || 0) + 1);
          }
        }
      }
    }

    return Array.from(wordCount.entries())
      .map(([text, value]) => ({ text, value }))
      .sort((a, b) => b.value - a.value);
  }, [rawLogs, selectedDate]);

  // Calculate activity items for the selected date (with session grouping)
  const activityItems = useMemo((): ActivityItem[] => {
    if (!selectedDate) return [];

    const entries = rawLogs
      .filter((log) => getDateString(log.timestamp) === selectedDate)
      .map(toActivityLogEntry)
      .filter((entry): entry is ActivityLogEntry => entry !== null)
      .sort((a, b) => a.timestamp - b.timestamp); // Sort chronologically

    const items: ActivityItem[] = [];
    const usedExecuteIds = new Set<string>();

    // Build sessions around each ToolDiscovery
    const discoveries = entries.filter((e) => e.type === "ToolDiscovery");
    const executes = entries.filter((e) => e.type === "ToolExecute");
    // CallTool, GetPrompt, ReadResource are displayed as standalone entries
    const standaloneEntries = entries.filter(
      (e) =>
        e.type === "CallTool" ||
        e.type === "GetPrompt" ||
        e.type === "ReadResource",
    );

    for (const discovery of discoveries) {
      // Find ToolExecute entries related to this Discovery
      const relatedExecutes: ActivityLogEntry[] = [];
      const discoveredToolKeys = new Set(
        discovery.discoveredTools?.map((t) => t.toolKey) || [],
      );

      for (const exec of executes) {
        // Skip already used Execute entries
        if (usedExecuteIds.has(exec.id)) continue;

        // Check if from the same client
        if (exec.clientId !== discovery.clientId) continue;

        // Check if within time range (after Discovery, within 30 minutes)
        const timeDiff = exec.timestamp - discovery.timestamp;
        if (timeDiff < 0 || timeDiff > SESSION_TIME_WINDOW_MS) continue;

        // Check if executing a discovered tool
        if (exec.toolKey && discoveredToolKeys.has(exec.toolKey)) {
          relatedExecutes.push(exec);
          usedExecuteIds.add(exec.id);
        }
      }

      // Add as session
      const session: ActivitySession = {
        id: discovery.id,
        timestamp: discovery.timestamp,
        clientId: discovery.clientId,
        clientName: discovery.clientName,
        discovery,
        executions: relatedExecutes.sort((a, b) => a.timestamp - b.timestamp),
      };

      items.push({ type: "session", session });
    }

    // Add unused ToolExecute entries as standalone
    for (const exec of executes) {
      if (!usedExecuteIds.has(exec.id)) {
        items.push({ type: "standalone", entry: exec });
      }
    }

    // Add CallTool, GetPrompt, ReadResource as standalone entries
    for (const entry of standaloneEntries) {
      items.push({ type: "standalone", entry });
    }

    // Sort with newest first
    return items.sort((a, b) => {
      const tsA =
        a.type === "session" ? a.session.timestamp : a.entry.timestamp;
      const tsB =
        b.type === "session" ? b.session.timestamp : b.entry.timestamp;
      return tsB - tsA;
    });
  }, [rawLogs, selectedDate]);

  return {
    heatmapData,
    wordCloudData,
    activityItems,
    loading,
    error,
    refetch: fetchData,
  };
};
