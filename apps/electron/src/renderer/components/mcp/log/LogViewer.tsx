import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { RequestLogEntry } from "@mcp_router/shared";
import { EMPTY_CURSOR, isEmptyCursor } from "@/renderer/utils/cursor";
import { useFilterState } from "./hooks/useFilterState";
import { useRequestLogs } from "./hooks/useRequestLogs";
import LogTable from "./components/LogTable";
import LogDetailModal from "./components/LogDetailModal";
import ToolCallTimeline from "./components/ToolCallTimeline";
import { Card } from "@mcp_router/ui";
import { useWorkspaceStore } from "../../../stores";

interface LogViewerProps {
  serverId?: string; // 特定のサーバのみ表示する場合は指定、なければすべてのサーバ
  initialLimit?: number;
}

const LogViewer: React.FC<LogViewerProps> = ({
  serverId,
  initialLimit = 50,
}) => {
  const { t } = useTranslation();
  const { currentWorkspace } = useWorkspaceStore();

  // Filter state management
  const { filters, setPagination, refresh } = useFilterState({
    limit: initialLimit,
  });

  // Request log data
  const { logs, total, nextCursor, hasMore, loading, fetchLogs } =
    useRequestLogs({
      serverId: serverId,
      clientId: filters.selectedClientId,
      startDate: filters.startDate,
      endDate: filters.endDate,
      requestType: filters.requestType,
      responseStatus: filters.responseStatus,
      cursor: filters.cursor,
      limit: filters.limit,
      refreshTrigger: filters.refreshTrigger, // Add refreshTrigger to dependencies
    });

  // State for selected logs and current index for modal navigation
  const [selectedLogs, setSelectedLogs] = useState<RequestLogEntry[]>([]);
  const [selectedLogIndex, setSelectedLogIndex] = useState<number>(0);
  const [lastDataUpdate, setLastDataUpdate] = useState<Date>(new Date());

  // State for cursor history to enable previous/next navigation
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  // Button to manually refresh data
  const handleManualRefresh = useCallback(() => {
    // Update the last refresh time indicator
    setLastDataUpdate(new Date());
    // Reset cursor and history when manually refreshing
    setPagination(undefined, filters.limit, 1);
    setCursorHistory([]);
    // Trigger data refresh by incrementing the refreshTrigger counter
    refresh();
  }, [refresh, setPagination, filters.limit]);

  // Handle page navigation
  const handlePageChange = useCallback(
    (direction: "next" | "previous") => {
      if (direction === "next" && nextCursor) {
        // Save current cursor to history before moving forward
        // For the first page, cursor is undefined, but we still need to save it
        setCursorHistory((prev) => [...prev, filters.cursor || EMPTY_CURSOR]);
        setPagination(nextCursor, filters.limit, filters.currentPage + 1);
      } else if (direction === "previous" && cursorHistory.length > 0) {
        // Pop the last cursor from history
        const newHistory = [...cursorHistory];
        const previousCursor = newHistory.pop();
        setCursorHistory(newHistory);
        // If previousCursor is empty, it means go back to first page (no cursor)
        setPagination(
          isEmptyCursor(previousCursor) ? undefined : previousCursor,
          filters.limit,
          filters.currentPage - 1,
        );
      }
    },
    [
      nextCursor,
      filters.cursor,
      filters.limit,
      filters.currentPage,
      setPagination,
      cursorHistory,
    ],
  );

  // Update last refresh time whenever logs change
  useEffect(() => {
    if (logs && logs.length > 0) {
      setLastDataUpdate(new Date());
    }
  }, [logs]);

  // Refresh logs when workspace changes
  useEffect(() => {
    if (currentWorkspace) {
      handleManualRefresh();
    }
  }, [currentWorkspace?.id, handleManualRefresh]);

  return (
    <div className="p-4 flex flex-col h-full">
      {/* Status indicator showing last refresh time with refresh button */}
      <div className="flex justify-end items-center text-sm text-muted-foreground mb-2 gap-2">
        <button
          onClick={handleManualRefresh}
          className="px-2 py-1 bg-primary/10 hover:bg-primary/20 rounded text-primary text-xs transition-colors"
          aria-label={t("logs.viewer.refresh")}
        >
          {t("logs.viewer.refresh")}
        </button>
        <span>
          {t("logs.viewer.lastUpdated")}: {lastDataUpdate.toLocaleTimeString()}
        </span>
      </div>

      {total === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <Card className="p-8 max-w-2xl w-full shadow-lg text-center">
            <Link
              to="/servers/add"
              className="px-6 py-3 rounded-md font-medium text-primary inline-block"
            >
              <h2 className="text-2xl font-bold mb-4">
                Add a server to start logging requests
              </h2>
            </Link>
          </Card>
        </div>
      ) : (
        <div className="flex flex-col space-y-6">
          {/* Tool call timeline */}
          <ToolCallTimeline
            logs={logs}
            loading={loading}
            onSelectLog={(log) => {
              setSelectedLogs([log]);
              setSelectedLogIndex(0);
            }}
            onSelectLogs={(logs, index = 0) => {
              setSelectedLogs(logs);
              setSelectedLogIndex(index);
            }}
          />

          {/* Request log table */}
          <LogTable
            logs={logs}
            total={total}
            loading={loading}
            currentPage={filters.currentPage}
            hasMore={hasMore}
            hasPrevious={cursorHistory.length > 0}
            limit={filters.limit}
            onSelectLog={(log) => {
              setSelectedLogs([log]);
              setSelectedLogIndex(0);
            }}
            onPageChange={handlePageChange}
            onLimitChange={(newLimit) => {
              setPagination(undefined, newLimit, 1);
              setCursorHistory([]);
            }}
          />
        </div>
      )}

      {/* Log detail modal */}
      {selectedLogs.length > 0 && (
        <LogDetailModal
          logs={selectedLogs}
          currentIndex={selectedLogIndex}
          onIndexChange={setSelectedLogIndex}
          onClose={() => {
            setSelectedLogs([]);
            setSelectedLogIndex(0);
          }}
        />
      )}
    </div>
  );
};

export default LogViewer;
