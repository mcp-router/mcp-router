import { useState, useEffect, useCallback } from "react";
import { RequestLogEntry } from "@mcp-router/shared";
import { usePlatformAPI } from "@mcp-router/platform-api";

interface RequestLogsParams {
  serverId?: string;
  clientId?: string;
  startDate?: Date;
  endDate?: Date;
  requestType?: string;
  responseStatus?: string;
  offset?: number;
  limit?: number;
  refreshTrigger?: number;
}

interface RequestLogsResult {
  logs: RequestLogEntry[];
  total: number;
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
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch log
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // console.log(`[useRequestLogs] Fetching request log:`, params);

      const result = await platformAPI.getRequestLogs({
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
        offset: params.offset || 0,
        limit: params.limit || 50,
      });

      if (Array.isArray(result.logs)) {
        setLogs(result.logs);
        setTotal(result.total);
      } else {
        console.error("Expected log to be an array but got:", result.logs);
        setLogs([]);
        setTotal(0);
        setError("Invalid response format");
      }
    } catch (error) {
      console.error("Failed to fetch request log:", error);
      setError("Failed to fetch request log");
      setLogs([]);
      setTotal(0);
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
    params.offset,
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
    loading,
    error,
    fetchLogs,
  };
};
