import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { HeatmapData } from "@mcp_router/shared";
import { Card } from "@mcp_router/ui";
import { cn } from "@/renderer/utils/tailwind-utils";

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
  if (count === 0 || maxCount === 0) return "bg-muted/20";

  const intensity = count / maxCount;
  if (intensity >= 0.75) return "bg-primary";
  if (intensity >= 0.5) return "bg-primary/70";
  if (intensity >= 0.25) return "bg-primary/40";
  return "bg-primary/20";
};

/**
 * Generate an array of dates for the last N days (from past to today)
 */
const generateDateRange = (days: number): string[] => {
  const dates: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    dates.push(dateStr);
  }

  return dates.reverse();
};

/**
 * Format date in short format
 */
const formatDateShort = (dateStr: string, locale: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
};

/**
 * Get day of week (0-6)
 */
const getDayOfWeek = (dateStr: string): number => {
  return new Date(dateStr).getDay();
};

const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
  data,
  selectedDate,
  onDateSelect,
  loading = false,
  days = 180,
}) => {
  const { t } = useTranslation();

  // Generate date range
  const dateRange = useMemo(() => generateDateRange(days), [days]);

  // Aggregate counts by date
  const dailyCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const cell of data.cells) {
      const current = counts.get(cell.date) || 0;
      counts.set(cell.date, current + cell.count);
    }

    return counts;
  }, [data.cells]);

  // Max daily count
  const maxDailyCount = useMemo(() => {
    let max = 0;
    for (const count of dailyCounts.values()) {
      max = Math.max(max, count);
    }
    return max;
  }, [dailyCounts]);

  // Group by week (GitHub style layout)
  const weeks = useMemo(() => {
    const result: string[][] = [];
    let currentWeek: string[] = Array(7).fill("");

    for (const date of dateRange) {
      const dayIndex = getDayOfWeek(date);
      currentWeek[dayIndex] = date;

      if (dayIndex === 6) {
        // End of week (Saturday)
        result.push(currentWeek);
        currentWeek = Array(7).fill("");
      }
    }

    // Add last partial week
    if (currentWeek.some((d) => d !== "")) {
      result.push(currentWeek);
    }

    return result;
  }, [dateRange]);

  if (loading) {
    return (
      <Card className="p-8 rounded-[2rem] border-border/40 bg-card/40 backdrop-blur-sm shadow-sm">
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  // Day labels
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
    <Card className="p-10 rounded-[2.5rem] border-border/40 bg-card/40 backdrop-blur-sm soft-shadow">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <span className="text-lg opacity-100">📊</span>
          {t("logs.activity.heatmap.title", "Activity Heatmap")}
        </h3>
        {selectedDate && (
          <div className="text-xs font-bold text-primary bg-primary/10 px-4 py-1.5 rounded-full">
            📅{" "}
            {new Date(selectedDate).toLocaleDateString(t("locale", "en-US"), {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
            {" • "}
            {dailyCounts.get(selectedDate) || 0}{" "}
            {t("logs.activity.heatmap.activities", "activities")}
          </div>
        )}
      </div>

      <div className="overflow-x-auto pb-4 -mb-4">
        <div className="inline-flex gap-2 pb-2 px-1">
          {/* Day labels */}
          <div className="flex flex-col gap-2 pr-4 pt-[2px] sticky left-0 bg-card/40 backdrop-blur-sm z-20">
            {dayLabels.map((label, i) => (
              <div
                key={i}
                className="h-[16px] text-[9px] font-black uppercase leading-[16px] text-muted-foreground/40"
              >
                {i % 2 === 0 ? label[0] : ""}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="flex gap-2">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-2">
                {week.map((date, dayIndex) => {
                  const count = date ? dailyCounts.get(date) || 0 : 0;
                  const isSelected = date === selectedDate;

                  if (!date) {
                    return (
                      <div
                        key={dayIndex}
                        className="w-[16px] h-[16px] rounded-sm bg-transparent"
                      />
                    );
                  }

                  return (
                    <button
                      key={dayIndex}
                      onClick={() => onDateSelect(date)}
                      className={cn(
                        "w-[16px] h-[16px] rounded-sm transition-all duration-200",
                        getHeatColor(count, maxDailyCount),
                        isSelected
                          ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-125 z-10"
                          : "hover:scale-125 hover:z-10",
                      )}
                      title={`${formatDateShort(date, t("locale", "en-US"))}: ${count} ${t("logs.activity.heatmap.activities", "activities")}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-10 pt-6 border-t border-border/20 flex items-center justify-end gap-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
        <span>{t("logs.activity.heatmap.less", "Less")}</span>
        <div className="flex gap-1.5">
          <div className="w-[12px] h-[12px] rounded-sm bg-muted/20" />
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
