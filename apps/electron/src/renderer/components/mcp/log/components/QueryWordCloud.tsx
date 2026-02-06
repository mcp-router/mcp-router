import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { WordCloudItem } from "@mcp_router/shared";
import { Card } from "@mcp_router/ui";
import { IconSearch } from "@tabler/icons-react";
import { cn } from "@/renderer/utils/tailwind-utils";

interface QueryWordCloudProps {
  data: WordCloudItem[];
  loading?: boolean;
  /** Maximum number of words to display */
  maxWords?: number;
}

/**
 * Calculate font size based on frequency
 */
const getFontSize = (value: number, maxValue: number): string => {
  if (maxValue === 0) return "text-sm";

  const ratio = value / maxValue;
  if (ratio >= 0.8) return "text-2xl font-bold";
  if (ratio >= 0.6) return "text-xl font-semibold";
  if (ratio >= 0.4) return "text-lg font-medium";
  if (ratio >= 0.2) return "text-base";
  return "text-sm";
};

/**
 * Return a color based on frequency
 */
const getWordColor = (value: number, maxValue: number): string => {
  if (maxValue === 0) return "text-muted-foreground";

  const ratio = value / maxValue;
  if (ratio >= 0.8) return "text-primary";
  if (ratio >= 0.6) return "text-primary/80";
  if (ratio >= 0.4) return "text-primary/60";
  if (ratio >= 0.2) return "text-foreground/80";
  return "text-muted-foreground";
};

const QueryWordCloud: React.FC<QueryWordCloudProps> = ({
  data,
  loading = false,
  maxWords = 30,
}) => {
  const { t } = useTranslation();

  // Limit display data
  const displayData = useMemo(() => {
    return data.slice(0, maxWords);
  }, [data, maxWords]);

  // Calculate max value
  const maxValue = useMemo(() => {
    return displayData.reduce((max, item) => Math.max(max, item.value), 0);
  }, [displayData]);

  if (loading) {
    return (
      <Card className="p-8 h-full rounded-[2rem] border-border/40 bg-card/40 backdrop-blur-sm shadow-sm">
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  if (displayData.length === 0) {
    return (
      <Card className="p-10 h-full rounded-[2.5rem] border-border/40 bg-card/40 backdrop-blur-sm soft-shadow">
        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 mb-8 flex items-center gap-2">
          <IconSearch size={16} className="text-primary/60" />
          {t("logs.activity.wordcloud.title", "Query Keywords")}
        </h3>
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground/40 text-sm bg-muted/10 rounded-3xl border border-dashed border-border/40">
          <IconSearch size={32} className="opacity-20 mb-4" />
          <p className="font-bold tracking-tight">
            {t("logs.activity.wordcloud.empty", "No queries for selected date")}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-10 h-full rounded-[2.5rem] border-border/40 bg-card/40 backdrop-blur-sm soft-shadow flex flex-col">
      <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 mb-8 flex items-center gap-2">
        <IconSearch size={16} className="text-primary/60" />
        {t("logs.activity.wordcloud.title", "Query Keywords")}
      </h3>

      <div className="flex-1 flex flex-wrap gap-x-4 gap-y-3 items-center justify-center min-h-48 px-4 bg-background/20 rounded-[1.5rem] border border-border/10 p-6 shadow-inner">
        {displayData.map((item, index) => (
          <span
            key={`${item.text}-${index}`}
            className={cn(
              "inline-block px-3 py-1 rounded-full transition-all duration-300 hover:scale-110 cursor-default tracking-tight",
              getFontSize(item.value, maxValue),
              getWordColor(item.value, maxValue),
            )}
            title={`${item.text}: ${item.value} ${t("logs.activity.wordcloud.times", "times")}`}
          >
            {item.text}
          </span>
        ))}
      </div>

      {data.length > maxWords && (
        <div className="mt-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 text-center">
          {t(
            "logs.activity.wordcloud.showing",
            "Showing {{count}} of {{total}} keywords",
            {
              count: maxWords,
              total: data.length,
            },
          )}
        </div>
      )}
    </Card>
  );
};

export default QueryWordCloud;
