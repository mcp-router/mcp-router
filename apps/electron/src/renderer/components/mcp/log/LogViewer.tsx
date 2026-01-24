import React, { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useWorkspaceStore } from "../../../stores";
import { useActivityData } from "./hooks/useActivityData";
import ActivityHeatmap from "./components/ActivityHeatmap";
import QueryWordCloud from "./components/QueryWordCloud";
import ActivityLog from "./components/ActivityLog";

interface LogViewerProps {
  /** ヒートマップ表示期間（日数） */
  heatmapDays?: number;
}

/**
 * 今日の日付をYYYY-MM-DD形式で取得
 */
const getTodayString = (): string => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};

const LogViewer: React.FC<LogViewerProps> = ({ heatmapDays = 30 }) => {
  const { t } = useTranslation();
  const { currentWorkspace } = useWorkspaceStore();

  // 選択中の日付（デフォルトは今日）
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Activity データ取得
  const { heatmapData, wordCloudData, activityItems, loading, refetch } =
    useActivityData({
      heatmapDays,
      selectedDate,
      refreshTrigger,
    });

  // 手動リフレッシュ
  const handleRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  // ワークスペース変更時にリフレッシュ
  useEffect(() => {
    if (currentWorkspace) {
      handleRefresh();
    }
  }, [currentWorkspace?.id, handleRefresh]);

  return (
    <div className="p-4 flex flex-col h-full gap-4">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">
          {t("logs.activity.title", "Activity")}
        </h2>
        <button
          onClick={handleRefresh}
          className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 rounded text-primary text-sm transition-colors"
          aria-label={t("logs.viewer.refresh", "Refresh")}
        >
          {t("logs.viewer.refresh", "Refresh")}
        </button>
      </div>

      {/* ヒートマップ */}
      <ActivityHeatmap
        data={heatmapData}
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        loading={loading}
        days={heatmapDays}
      />

      {/* Word Cloud と Activity Log を横並びに */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        {/* Word Cloud (1/3) */}
        <div className="lg:col-span-1">
          <QueryWordCloud data={wordCloudData} loading={loading} />
        </div>

        {/* Activity Log (2/3) */}
        <div className="lg:col-span-2 min-h-0">
          <ActivityLog items={activityItems} loading={loading} />
        </div>
      </div>
    </div>
  );
};

export default LogViewer;
