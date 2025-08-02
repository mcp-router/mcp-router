import { useState, useEffect, useCallback } from "react";
import { RequestLogEntry } from "@mcp_router/shared";
import { usePlatformAPI } from "@/renderer/platform-api";

interface RequestLogsParams {
  serverId?: string;
  clientId?: string;
  startDate?: Date;
  endDate?: Date;
  requestType?: string;
  responseStatus?: string;
  cursor?: string;
  limit?: number;
  refreshTrigger?: number;
}

interface RequestLogsResult {
  logs: RequestLogEntry[];
  total: number;
  nextCursor?: string;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  fetchLogs: () => Promise<void>;
}

/**
 * Custom hook for fetching and managing request log
 */
export const useRequestLogs = (
  params: RequestLogsParams,
): RequestLogsResult => {
  const platformAPI = usePlatformAPI();
  const [logs, setLogs] = useState<RequestLogEntry[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch log
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // console.log(`[useRequestLogs] Fetching request log:`, params);

      const result = await platformAPI.logs.query({
        serverId: params.serverId || undefined,
        clientId: params.clientId || undefined,
        startDate: params.startDate,
        endDate: params.endDate,
        requestType: params.requestType || undefined,
        responseStatus:
          params.responseStatus === "success"
            ? "success"
            : params.responseStatus === "error"
              ? "error"
              : undefined,
        cursor: params.cursor,
        limit: params.limit || 50,
      });

      if (Array.isArray(result.logs)) {
        // result.logsは既にRequestLogEntry[]型として扱う
        setLogs(result.logs as RequestLogEntry[]);
        setTotal(result.total);
        setNextCursor(result.nextCursor);
        setHasMore(result.hasMore);
      } else {
        console.error("Expected log to be an array but got:", result.logs);
        setLogs([]);
        setTotal(0);
        setNextCursor(undefined);
        setHasMore(false);
        setError("Invalid response format");
      }
    } catch (error) {
      console.error("Failed to fetch request log:", error);
      setError("Failed to fetch request log");
      setLogs([]);
      setTotal(0);
      setNextCursor(undefined);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [
    params.serverId,
    params.clientId,
    params.startDate,
    params.endDate,
    params.requestType,
    params.responseStatus,
    params.cursor,
    params.limit,
    params.refreshTrigger,
  ]);

  // Fetch log when params change or refresh is triggered
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return {
    logs,
    total,
    nextCursor,
    hasMore,
    loading,
    error,
    fetchLogs,
  };
};
