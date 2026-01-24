import React, { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  IconChevronRight,
  IconSearch,
  IconPlayerPlay,
  IconCheck,
  IconX,
  IconMessage,
  IconFile,
} from "@tabler/icons-react";
import {
  ActivityLogEntry,
  ActivityItem,
  ActivitySession,
} from "@mcp_router/shared";
import { Card } from "@mcp_router/ui";
import { cn } from "@/renderer/utils/tailwind-utils";

interface ActivityLogProps {
  items: ActivityItem[];
  loading?: boolean;
}

/**
 * 時刻をフォーマット
 */
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

/**
 * JSONを整形して表示
 */
const formatJson = (data: unknown): string => {
  if (data === undefined || data === null) return "-";
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
};

/**
 * 実行ツール行（アコーディオン）
 */
const ExecutionRow: React.FC<{
  exec: ActivityLogEntry;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ exec, isExpanded, onToggle }) => {
  const { t } = useTranslation();
  const hasError = exec.status === "error";
  const toolName = exec.toolName || exec.toolKey?.split(":")[1] || "unknown";

  return (
    <div className="border-t border-border/50 first:border-t-0">
      {/* 実行行ヘッダー */}
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors",
          isExpanded && "bg-muted/20",
        )}
      >
        <IconChevronRight
          size={14}
          className={cn(
            "text-muted-foreground transition-transform duration-200 shrink-0",
            isExpanded && "rotate-90",
          )}
        />
        <IconPlayerPlay
          size={14}
          className={cn(
            "shrink-0",
            hasError ? "text-destructive" : "text-primary",
          )}
        />
        <span
          className={cn(
            "text-sm font-medium flex-1 truncate",
            hasError ? "text-destructive" : "text-foreground",
          )}
        >
          {toolName}
        </span>
        <span className="text-xs text-muted-foreground shrink-0">
          {exec.duration}ms
        </span>
        {hasError ? (
          <IconX size={14} className="text-destructive shrink-0" />
        ) : (
          <IconCheck size={14} className="text-green-600 shrink-0" />
        )}
      </button>

      {/* 展開時の詳細 */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 bg-muted/10 text-xs space-y-2">
          {/* Arguments */}
          <div>
            <p className="text-muted-foreground font-medium mb-1">
              {t("logs.activity.log.arguments", "Arguments")}
            </p>
            <pre className="bg-background/50 border border-border/50 rounded p-2 overflow-x-auto max-h-32 text-[11px]">
              {formatJson(exec.arguments)}
            </pre>
          </div>

          {/* Error or Result */}
          {hasError && exec.errorMessage ? (
            <div>
              <p className="text-destructive font-medium mb-1">
                {t("logs.activity.log.error", "Error")}
              </p>
              <pre className="bg-destructive/10 border border-destructive/30 rounded p-2 overflow-x-auto max-h-32 text-[11px] text-destructive">
                {exec.errorMessage}
              </pre>
            </div>
          ) : (
            <div>
              <p className="text-muted-foreground font-medium mb-1">
                {t("logs.activity.log.result", "Result")}
              </p>
              <pre className="bg-background/50 border border-border/50 rounded p-2 overflow-x-auto max-h-48 text-[11px]">
                {formatJson(exec.responseData)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * セッションカード（ToolDiscovery + 関連ToolExecute）
 */
const SessionCard: React.FC<{
  session: ActivitySession;
  expandedExecIds: Set<string>;
  onToggleExec: (id: string) => void;
}> = ({ session, expandedExecIds, onToggleExec }) => {
  const { t } = useTranslation();
  const { discovery, executions } = session;
  const hasError =
    discovery.status === "error" ||
    executions.some((e) => e.status === "error");

  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden",
        hasError ? "border-destructive/30" : "border-border",
      )}
    >
      {/* ヘッダー部分 */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Context */}
            {discovery.context ? (
              <p className="text-sm font-medium text-foreground line-clamp-2">
                {discovery.context}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                {t("logs.activity.log.noContext", "Tool search")}
              </p>
            )}

            {/* クエリタグ */}
            {discovery.query && discovery.query.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {discovery.query.slice(0, 5).map((q: string, i: number) => (
                  <span
                    key={i}
                    className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded"
                  >
                    {q}
                  </span>
                ))}
                {discovery.query.length > 5 && (
                  <span className="text-xs text-muted-foreground">
                    +{discovery.query.length - 5}
                  </span>
                )}
              </div>
            )}
          </div>

          <span className="text-xs text-muted-foreground shrink-0">
            {formatTime(discovery.timestamp)}
          </span>
        </div>
      </div>

      {/* 実行ツール一覧 */}
      {executions.length > 0 && (
        <div className="border-t border-border/50">
          {executions.map((exec) => (
            <ExecutionRow
              key={exec.id}
              exec={exec}
              isExpanded={expandedExecIds.has(exec.id)}
              onToggle={() => onToggleExec(exec.id)}
            />
          ))}
        </div>
      )}

      {/* 実行なしの場合 */}
      {executions.length === 0 && (
        <div className="border-t border-border/50 px-3 py-2 text-xs text-muted-foreground italic">
          {t("logs.activity.log.noExecutions", "No tools executed")}
        </div>
      )}
    </div>
  );
};

/**
 * タイプに応じたアイコンを返す
 */
const getActivityIcon = (
  type: ActivityLogEntry["type"],
  hasError: boolean,
): React.ReactNode => {
  const iconClass = cn(
    "shrink-0",
    hasError ? "text-destructive" : "text-primary",
  );

  switch (type) {
    case "ToolExecute":
    case "CallTool":
      return <IconPlayerPlay size={14} className={iconClass} />;
    case "GetPrompt":
      return <IconMessage size={14} className={iconClass} />;
    case "ReadResource":
      return <IconFile size={14} className={iconClass} />;
    default:
      return <IconPlayerPlay size={14} className={iconClass} />;
  }
};

/**
 * タイプに応じた表示名を返す
 */
const getActivityDisplayName = (entry: ActivityLogEntry): string => {
  switch (entry.type) {
    case "ToolExecute":
    case "CallTool":
      return entry.toolName || entry.toolKey?.split(":")[1] || "unknown";
    case "GetPrompt":
      return entry.promptName || "unknown";
    case "ReadResource":
      return entry.resourceUri || "unknown";
    default:
      return "unknown";
  }
};

/**
 * 単独のアクティビティカード（ToolExecute、CallTool、GetPrompt、ReadResource）
 */
const StandaloneCard: React.FC<{
  entry: ActivityLogEntry;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ entry, isExpanded, onToggle }) => {
  const { t } = useTranslation();
  const hasError = entry.status === "error";
  const displayName = getActivityDisplayName(entry);
  const hasArguments = entry.type !== "ReadResource";

  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden",
        hasError ? "border-destructive/30" : "border-border",
      )}
    >
      {/* ヘッダー */}
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-2 p-3 text-left hover:bg-muted/30 transition-colors",
          isExpanded && "bg-muted/20",
        )}
      >
        <IconChevronRight
          size={14}
          className={cn(
            "text-muted-foreground transition-transform duration-200 shrink-0",
            isExpanded && "rotate-90",
          )}
        />
        {getActivityIcon(entry.type, hasError)}
        <span
          className={cn(
            "text-sm font-medium flex-1 truncate",
            hasError ? "text-destructive" : "text-foreground",
          )}
        >
          {displayName}
        </span>
        <span className="text-xs text-muted-foreground">
          {entry.serverName}
        </span>
        <span className="text-xs text-muted-foreground shrink-0">
          {entry.duration}ms
        </span>
        <span className="text-xs text-muted-foreground shrink-0">
          {formatTime(entry.timestamp)}
        </span>
        {hasError ? (
          <IconX size={14} className="text-destructive shrink-0" />
        ) : (
          <IconCheck size={14} className="text-green-600 shrink-0" />
        )}
      </button>

      {/* 展開時の詳細 */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border/50 bg-muted/10 text-xs space-y-2">
          {/* Arguments (ReadResource以外) */}
          {hasArguments && (
            <div>
              <p className="text-muted-foreground font-medium mb-1">
                {t("logs.activity.log.arguments", "Arguments")}
              </p>
              <pre className="bg-background/50 border border-border/50 rounded p-2 overflow-x-auto max-h-32 text-[11px]">
                {formatJson(entry.arguments)}
              </pre>
            </div>
          )}

          {/* Error or Result */}
          {hasError && entry.errorMessage ? (
            <div>
              <p className="text-destructive font-medium mb-1">
                {t("logs.activity.log.error", "Error")}
              </p>
              <pre className="bg-destructive/10 border border-destructive/30 rounded p-2 overflow-x-auto max-h-32 text-[11px] text-destructive">
                {entry.errorMessage}
              </pre>
            </div>
          ) : (
            <div>
              <p className="text-muted-foreground font-medium mb-1">
                {t("logs.activity.log.result", "Result")}
              </p>
              <pre className="bg-background/50 border border-border/50 rounded p-2 overflow-x-auto max-h-48 text-[11px]">
                {formatJson(entry.responseData)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ActivityLog: React.FC<ActivityLogProps> = ({
  items,
  loading = false,
}) => {
  const { t } = useTranslation();
  const [expandedExecIds, setExpandedExecIds] = useState<Set<string>>(
    new Set(),
  );

  const toggleExec = useCallback((id: string) => {
    setExpandedExecIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  if (loading) {
    return (
      <Card className="p-4 h-full">
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
        </div>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="p-4 h-full">
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
          <IconSearch size={16} className="text-muted-foreground" />
          {t("logs.activity.log.title", "Activity Log")}
        </h3>
        <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
          {t("logs.activity.log.empty", "No activities for selected date")}
        </div>
      </Card>
    );
  }

  // 統計
  const stats = {
    sessions: items.filter((i) => i.type === "session").length,
    executions: items.reduce((acc, item) => {
      if (item.type === "session") {
        return acc + item.session.executions.length;
      }
      return acc + 1;
    }, 0),
  };

  return (
    <Card className="p-4 h-full overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <IconSearch size={16} className="text-muted-foreground" />
          {t("logs.activity.log.title", "Activity Log")}
        </h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            {stats.sessions} {t("logs.activity.log.sessions", "sessions")}
          </span>
          <span>
            {stats.executions} {t("logs.activity.log.executions", "executions")}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {items.map((item) => {
          if (item.type === "session") {
            return (
              <SessionCard
                key={item.session.id}
                session={item.session}
                expandedExecIds={expandedExecIds}
                onToggleExec={toggleExec}
              />
            );
          } else {
            return (
              <StandaloneCard
                key={item.entry.id}
                entry={item.entry}
                isExpanded={expandedExecIds.has(item.entry.id)}
                onToggle={() => toggleExec(item.entry.id)}
              />
            );
          }
        })}
      </div>
    </Card>
  );
};

export default ActivityLog;
