import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { HeatmapData } from "@mcp_router/shared";
import { Card } from "@mcp_router/ui";

interface ActivityHeatmapProps {
  data: HeatmapData;
  selectedDate: string | null;
  onDateSelect: (date: string) => void;
  loading?: boolean;
  /** 表示する日数 */
  days?: number;
}

/**
 * アクティビティカウントに応じた色を返す
 */
const getHeatColor = (count: number, maxCount: number): string => {
  if (count === 0 || maxCount === 0) return "bg-muted/30";

  const intensity = count / maxCount;
  if (intensity >= 0.75) return "bg-primary";
  if (intensity >= 0.5) return "bg-primary/70";
  if (intensity >= 0.25) return "bg-primary/40";
  return "bg-primary/20";
};

/**
 * 過去N日間の日付配列を生成（今日から過去に向かって）
 */
const generateDateRange = (days: number): string[] => {
  const dates: string[] = [];
  const today = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    dates.push(dateStr);
  }

  return dates.reverse(); // 古い日付が先に来るように
};

/**
 * 日付を短い形式でフォーマット
 */
const formatDateShort = (dateStr: string, locale: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
};

/**
 * 曜日を取得
 */
const getDayOfWeek = (dateStr: string): number => {
  return new Date(dateStr).getDay();
};

const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
  data,
  selectedDate,
  onDateSelect,
  loading = false,
  days = 30,
}) => {
  const { t } = useTranslation();

  // 日付範囲を生成
  const dateRange = useMemo(() => generateDateRange(days), [days]);

  // 日付ごとのカウントを集計
  const dailyCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const cell of data.cells) {
      const current = counts.get(cell.date) || 0;
      counts.set(cell.date, current + cell.count);
    }

    return counts;
  }, [data.cells]);

  // 最大カウント（日単位）
  const maxDailyCount = useMemo(() => {
    let max = 0;
    for (const count of dailyCounts.values()) {
      max = Math.max(max, count);
    }
    return max;
  }, [dailyCounts]);

  // 週ごとにグループ化（GitHub風レイアウト用）
  const weeks = useMemo(() => {
    const result: string[][] = [];
    let currentWeek: string[] = [];

    // 最初の日付の曜日に合わせて空白を追加
    if (dateRange.length > 0) {
      const firstDayOfWeek = getDayOfWeek(dateRange[0]);
      for (let i = 0; i < firstDayOfWeek; i++) {
        currentWeek.push("");
      }
    }

    for (const date of dateRange) {
      currentWeek.push(date);
      if (getDayOfWeek(date) === 6) {
        // 土曜日で週を区切る
        result.push(currentWeek);
        currentWeek = [];
      }
    }

    // 残りの日を追加
    if (currentWeek.length > 0) {
      result.push(currentWeek);
    }

    return result;
  }, [dateRange]);

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  // 曜日ラベル
  const dayLabels = [
    t("logs.activity.heatmap.sun", "Sun"),
    t("logs.activity.heatmap.mon", "Mon"),
    t("logs.activity.heatmap.tue", "Tue"),
    t("logs.activity.heatmap.wed", "Wed"),
    t("logs.activity.heatmap.thu", "Thu"),
    t("logs.activity.heatmap.fri", "Fri"),
    t("logs.activity.heatmap.sat", "Sat"),
  ];

  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
        <span>📊</span>
        {t("logs.activity.heatmap.title", "Activity Heatmap")}
      </h3>

      <div className="overflow-x-auto">
        <div className="inline-flex gap-[3px]">
          {/* 曜日ラベル（縦に7行） */}
          <div className="flex flex-col gap-[3px] pr-2">
            {dayLabels.map((label, i) => (
              <div
                key={i}
                className="h-[12px] text-[10px] leading-[12px] text-muted-foreground"
              >
                {i % 2 === 0 ? label : ""}
              </div>
            ))}
          </div>

          {/* ヒートマップグリッド（週が列、曜日が行） */}
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-[3px]">
              {Array.from({ length: 7 }).map((_, dayIndex) => {
                const date = week[dayIndex] || "";
                const count = date ? dailyCounts.get(date) || 0 : 0;
                const isSelected = date === selectedDate;

                if (!date) {
                  return (
                    <div
                      key={dayIndex}
                      className="w-[12px] h-[12px] rounded-sm bg-transparent"
                    />
                  );
                }

                return (
                  <button
                    key={dayIndex}
                    onClick={() => onDateSelect(date)}
                    className={`
                      w-[12px] h-[12px] rounded-sm transition-all
                      ${getHeatColor(count, maxDailyCount)}
                      ${isSelected ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}
                      hover:ring-1 hover:ring-muted-foreground
                    `}
                    title={`${formatDateShort(date, t("locale", "en-US"))}: ${count} ${t("logs.activity.heatmap.activities", "activities")}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 選択中の日付表示 */}
      {selectedDate && (
        <div className="mt-3 text-sm text-muted-foreground">
          📅{" "}
          {new Date(selectedDate).toLocaleDateString(t("locale", "en-US"), {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "long",
          })}
          {" - "}
          {dailyCounts.get(selectedDate) || 0}{" "}
          {t("logs.activity.heatmap.activities", "activities")}
        </div>
      )}

      {/* 凡例 */}
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{t("logs.activity.heatmap.less", "Less")}</span>
        <div className="flex gap-[3px]">
          <div className="w-[12px] h-[12px] rounded-sm bg-muted/30" />
          <div className="w-[12px] h-[12px] rounded-sm bg-primary/20" />
          <div className="w-[12px] h-[12px] rounded-sm bg-primary/40" />
          <div className="w-[12px] h-[12px] rounded-sm bg-primary/70" />
          <div className="w-[12px] h-[12px] rounded-sm bg-primary" />
        </div>
        <span>{t("logs.activity.heatmap.more", "More")}</span>
      </div>
    </Card>
  );
};

export default ActivityHeatmap;
