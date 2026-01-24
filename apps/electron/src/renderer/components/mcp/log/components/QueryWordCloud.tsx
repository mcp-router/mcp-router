import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { WordCloudItem } from "@mcp_router/shared";
import { Card } from "@mcp_router/ui";

interface QueryWordCloudProps {
  data: WordCloudItem[];
  loading?: boolean;
  /** 最大表示単語数 */
  maxWords?: number;
}

/**
 * 頻度に応じたフォントサイズを計算
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
 * 頻度に応じた色を返す
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

  // 表示するデータを制限
  const displayData = useMemo(() => {
    return data.slice(0, maxWords);
  }, [data, maxWords]);

  // 最大値を計算
  const maxValue = useMemo(() => {
    return displayData.reduce((max, item) => Math.max(max, item.value), 0);
  }, [displayData]);

  if (loading) {
    return (
      <Card className="p-4 h-full">
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  if (displayData.length === 0) {
    return (
      <Card className="p-4 h-full">
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
          <span>🔍</span>
          {t("logs.activity.wordcloud.title", "Query Keywords")}
        </h3>
        <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
          {t("logs.activity.wordcloud.empty", "No queries for selected date")}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 h-full">
      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
        <span>🔍</span>
        {t("logs.activity.wordcloud.title", "Query Keywords")}
      </h3>

      <div className="flex flex-wrap gap-2 items-center justify-center min-h-24">
        {displayData.map((item, index) => (
          <span
            key={`${item.text}-${index}`}
            className={`
              inline-block px-2 py-1 rounded transition-opacity hover:opacity-80
              ${getFontSize(item.value, maxValue)}
              ${getWordColor(item.value, maxValue)}
            `}
            title={`${item.text}: ${item.value} ${t("logs.activity.wordcloud.times", "times")}`}
          >
            {item.text}
          </span>
        ))}
      </div>

      {data.length > maxWords && (
        <div className="mt-2 text-xs text-muted-foreground text-center">
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
