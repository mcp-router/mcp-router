import React from "react";
import { useTranslation } from "react-i18next";
import { IconFilter } from "@tabler/icons-react";
import { cn } from "@/renderer/utils/tailwind-utils";

export interface ActivityLogFilters {
  status: "all" | "success" | "error";
  minDuration: number | null;
}

interface ActivityLogFilterBarProps {
  filters: ActivityLogFilters;
  onFiltersChange: (filters: ActivityLogFilters) => void;
}

const DURATION_OPTIONS = [
  { value: null, label: "All" },
  { value: 100, label: ">100ms" },
  { value: 500, label: ">500ms" },
  { value: 1000, label: ">1s" },
  { value: 5000, label: ">5s" },
];

const ActivityLogFilterBar: React.FC<ActivityLogFilterBarProps> = ({
  filters,
  onFiltersChange,
}) => {
  const { t } = useTranslation();

  const handleStatusChange = (status: ActivityLogFilters["status"]) => {
    onFiltersChange({ ...filters, status });
  };

  const handleDurationChange = (minDuration: number | null) => {
    onFiltersChange({ ...filters, minDuration });
  };

  return (
    <div className="flex items-center gap-6 mb-2 flex-wrap">
      {/* Status filter */}
      <div className="flex items-center gap-2 bg-muted/20 p-1 rounded-full border border-border/40 shadow-inner">
        {(["all", "success", "error"] as const).map((status) => (
          <button
            key={status}
            onClick={() => handleStatusChange(status)}
            className={cn(
              "px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full transition-all duration-300",
              filters.status === status
                ? "bg-primary text-primary-foreground shadow-sm scale-105"
                : "text-muted-foreground/60 hover:text-primary hover:bg-primary/5",
            )}
          >
            {t(
              `logs.activity.filter.status.${status}`,
              status.charAt(0).toUpperCase() + status.slice(1),
            )}
          </button>
        ))}
      </div>

      {/* Duration filter */}
      <div className="flex items-center gap-2 bg-muted/20 p-1 rounded-full border border-border/40 shadow-inner">
        <div className="pl-3 pr-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
          {t("logs.activity.filter.duration", "Time")}:
        </div>
        {DURATION_OPTIONS.map((option) => (
          <button
            key={option.value ?? "all"}
            onClick={() => handleDurationChange(option.value)}
            className={cn(
              "px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full transition-all duration-300",
              filters.minDuration === option.value
                ? "bg-primary text-primary-foreground shadow-sm scale-105"
                : "text-muted-foreground/60 hover:text-primary hover:bg-primary/5",
            )}
          >
            {option.value === null
              ? t("logs.activity.filter.duration.all", "All")
              : option.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ActivityLogFilterBar;
