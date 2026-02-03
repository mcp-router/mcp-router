import React, { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useWorkspaceStore } from "../../../stores";
import { useActivityData } from "./hooks/useActivityData";
import ActivityHeatmap from "./components/ActivityHeatmap";
import QueryWordCloud from "./components/QueryWordCloud";
import ActivityLog from "./components/ActivityLog";
import { IconActivity, IconRefresh } from "@tabler/icons-react";
import { Button } from "@mcp_router/ui";
import { cn } from "@/renderer/utils/tailwind-utils";

interface LogViewerProps {
  /** Display period for heatmap (days) */
  heatmapDays?: number;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
const getTodayString = (): string => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};

const LogViewer: React.FC<LogViewerProps> = ({ heatmapDays = 180 }) => {
  const { t } = useTranslation();
  const { currentWorkspace } = useWorkspaceStore();

  // Selected date (default is today)
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Activity Data fetching
  const {
    heatmapData,
    wordCloudData,
    activityItems,
    loading,
    refetch: _refetch,
  } = useActivityData({
    heatmapDays,
    selectedDate,
    refreshTrigger,
  });

  // Manual refresh
  const handleRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  // Refresh on workspace change
  useEffect(() => {
    if (currentWorkspace) {
      handleRefresh();
    }
  }, [currentWorkspace?.id, handleRefresh]);

  return (
    <div className="flex flex-col min-h-full bg-background/30">
      {/* Header */}
      <div className="flex items-center justify-between p-10 bg-background/50 backdrop-blur-md border-b border-border/40">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-2.5 rounded-2xl">
            <IconActivity className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">
            {t("logs.activity.title", { defaultValue: "Activity" })}
          </h2>
        </div>
        <Button
          onClick={handleRefresh}
          variant="outline"
          className="rounded-full px-6 h-11 font-bold shadow-sm border-border/60 gap-2"
          aria-label={t("logs.viewer.refresh", "Refresh")}
        >
          <IconRefresh className={cn("w-4 h-4", loading && "animate-spin")} />
          {t("logs.viewer.refresh", "Refresh")}
        </Button>
      </div>

      <div className="p-10 space-y-8 max-w-[1400px] mx-auto w-full">
        {/* Heatmap */}
        <ActivityHeatmap
          data={heatmapData}
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          loading={loading}
          days={heatmapDays}
        />

        {/* Word Cloud and Activity Log */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Word Cloud (1/3) */}
          <div className="lg:col-span-1">
            <QueryWordCloud data={wordCloudData} loading={loading} />
          </div>

          {/* Activity Log (2/3) */}
          <div className="lg:col-span-2">
            <ActivityLog items={activityItems} loading={loading} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogViewer;
