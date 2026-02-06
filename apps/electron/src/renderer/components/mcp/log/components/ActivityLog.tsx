import React, { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  IconChevronRight,
  IconSearch,
  IconPlayerPlay,
  IconCheck,
  IconX,
  IconMessage,
  IconFile,
  IconActivity,
} from "@tabler/icons-react";
import {
  ActivityLogEntry,
  ActivityItem,
  ActivitySession,
} from "@mcp_router/shared";
import { Card } from "@mcp_router/ui";
import { cn } from "@/renderer/utils/tailwind-utils";
import ActivityLogFilterBar, {
  ActivityLogFilters,
} from "./ActivityLogFilterBar";

interface ActivityLogProps {
  items: ActivityItem[];
  loading?: boolean;
}

/**
 * Format a timestamp as time string
 */
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

/**
 * Pretty-print JSON data
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
 * Tool execution row (accordion)
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
    <div className="border-t border-border/20 first:border-t-0">
      {/* Execution row header */}
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-primary/5 transition-all duration-200",
          isExpanded && "bg-primary/5",
        )}
      >
        <IconChevronRight
          size={14}
          className={cn(
            "text-muted-foreground transition-transform duration-300 shrink-0",
            isExpanded && "rotate-90",
          )}
        />
        <div
          className={cn(
            "p-1.5 rounded-lg shrink-0",
            hasError
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary",
          )}
        >
          <IconPlayerPlay size={14} className="stroke-[2.5]" />
        </div>
        <span
          className={cn(
            "text-sm font-bold flex-1 truncate tracking-tight",
            hasError ? "text-destructive" : "text-foreground",
          )}
        >
          {toolName}
        </span>
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 shrink-0 bg-muted/30 px-2 py-0.5 rounded-full">
          {exec.duration}ms
        </span>
        {hasError ? (
          <div className="bg-destructive/10 p-1 rounded-full">
            <IconX size={12} className="text-destructive stroke-[3]" />
          </div>
        ) : (
          <div className="bg-emerald-500/10 p-1 rounded-full">
            <IconCheck size={12} className="text-emerald-600 stroke-[3]" />
          </div>
        )}
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-11 pb-5 pt-1 bg-muted/5 text-xs space-y-4">
          {/* Arguments */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">
              {t("logs.activity.log.arguments", "Arguments")}
            </p>
            <pre className="bg-background/50 border border-border/40 rounded-xl p-4 overflow-x-auto max-h-48 font-mono text-[11px] leading-relaxed shadow-inner">
              {formatJson(exec.arguments)}
            </pre>
          </div>

          {/* Error or Result */}
          {hasError && exec.errorMessage ? (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-destructive/60 mb-2">
                {t("logs.activity.log.error", "Error")}
              </p>
              <pre className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 overflow-x-auto max-h-48 font-mono text-[11px] text-destructive leading-relaxed shadow-inner">
                {exec.errorMessage}
              </pre>
            </div>
          ) : (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">
                {t("logs.activity.log.result", "Result")}
              </p>
              <pre className="bg-background/50 border border-border/40 rounded-xl p-4 overflow-x-auto max-h-64 font-mono text-[11px] leading-relaxed shadow-inner">
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
 * Session card (ToolDiscovery + related ToolExecute)
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
        "border rounded-[1.5rem] overflow-hidden bg-card/20 backdrop-blur-sm transition-all hover:bg-card/30",
        hasError ? "border-destructive/20" : "border-border/40",
      )}
    >
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Context */}
            {discovery.context ? (
              <p className="text-sm font-bold text-foreground line-clamp-2 tracking-tight leading-snug">
                {discovery.context}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground/60 italic font-medium">
                {t("logs.activity.log.noContext", "Tool search")}
              </p>
            )}

            {/* Query tags */}
            {discovery.query && discovery.query.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {discovery.query.slice(0, 5).map((q: string, i: number) => (
                  <span
                    key={i}
                    className="text-[10px] font-black uppercase tracking-widest text-primary/70 bg-primary/10 px-2 py-0.5 rounded-full border border-primary/5"
                  >
                    {q}
                  </span>
                ))}
                {discovery.query.length > 5 && (
                  <span className="text-[10px] font-bold text-muted-foreground/40 px-1 pt-0.5">
                    +{discovery.query.length - 5}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 bg-muted/30 px-2 py-0.5 rounded-full">
              {formatTime(discovery.timestamp)}
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-primary/40">
              {session.clientName}
            </span>
          </div>
        </div>
      </div>

      {/* Executed tools */}
      {executions.length > 0 && (
        <div className="border-t border-border/20 bg-background/30">
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

      {/* No executions */}
      {executions.length === 0 && (
        <div className="border-t border-border/20 px-5 py-3 text-[11px] text-muted-foreground/40 font-medium italic bg-background/20">
          {t("logs.activity.log.noExecutions", "No tools executed")}
        </div>
      )}
    </div>
  );
};

/**
 * Return an icon based on the activity type
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
 * Return a display name based on the activity type
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
 * Standalone activity card (ToolExecute, CallTool, GetPrompt, ReadResource)
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
        "border rounded-[1.5rem] overflow-hidden bg-card/20 backdrop-blur-sm transition-all hover:bg-card/30",
        hasError ? "border-destructive/20" : "border-border/40",
      )}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-3 p-5 text-left hover:bg-primary/5 transition-all duration-200",
          isExpanded && "bg-primary/5",
        )}
      >
        <IconChevronRight
          size={14}
          className={cn(
            "text-muted-foreground transition-transform duration-300 shrink-0",
            isExpanded && "rotate-90",
          )}
        />
        <div
          className={cn(
            "p-1.5 rounded-lg shrink-0",
            hasError
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary",
          )}
        >
          {getActivityIcon(entry.type, hasError)}
        </div>
        <div className="flex-1 min-w-0">
          <span
            className={cn(
              "text-sm font-bold block truncate tracking-tight",
              hasError ? "text-destructive" : "text-foreground",
            )}
          >
            {displayName}
          </span>
          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-primary/40 block mt-0.5">
            {entry.serverName}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 bg-muted/30 px-2 py-0.5 rounded-full">
              {entry.duration}ms
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
              {formatTime(entry.timestamp)}
            </span>
          </div>
          {hasError ? (
            <div className="bg-destructive/10 p-1 rounded-full">
              <IconX size={12} className="text-destructive stroke-[3]" />
            </div>
          ) : (
            <div className="bg-emerald-500/10 p-1 rounded-full">
              <IconCheck size={12} className="text-emerald-600 stroke-[3]" />
            </div>
          )}
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-11 pb-5 pt-1 border-t border-border/20 bg-muted/5 text-xs space-y-4">
          {/* Arguments */}
          {hasArguments && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">
                {t("logs.activity.log.arguments", "Arguments")}
              </p>
              <pre className="bg-background/50 border border-border/40 rounded-xl p-4 overflow-x-auto max-h-48 font-mono text-[11px] leading-relaxed shadow-inner">
                {formatJson(entry.arguments)}
              </pre>
            </div>
          )}

          {/* Error or Result */}
          {hasError && entry.errorMessage ? (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-destructive/60 mb-2">
                {t("logs.activity.log.error", "Error")}
              </p>
              <pre className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 overflow-x-auto max-h-48 font-mono text-[11px] text-destructive leading-relaxed shadow-inner">
                {entry.errorMessage}
              </pre>
            </div>
          ) : (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">
                {t("logs.activity.log.result", "Result")}
              </p>
              <pre className="bg-background/50 border border-border/40 rounded-xl p-4 overflow-x-auto max-h-64 font-mono text-[11px] leading-relaxed shadow-inner">
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
  const [filters, setFilters] = useState<ActivityLogFilters>({
    status: "all",
    minDuration: null,
  });

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Get the entries to check
      const entries =
        item.type === "session"
          ? [item.session.discovery, ...item.session.executions]
          : [item.entry];

      // Status filter
      if (filters.status !== "all") {
        const hasMatchingStatus = entries.some((e) =>
          filters.status === "error"
            ? e.status === "error"
            : e.status !== "error",
        );
        if (!hasMatchingStatus) return false;
      }

      // Duration filter
      if (filters.minDuration !== null) {
        const maxDuration = Math.max(...entries.map((e) => e.duration || 0));
        if (maxDuration < filters.minDuration) return false;
      }

      return true;
    });
  }, [items, filters]);

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
      <Card className="p-8 h-full rounded-[2rem] border-border/40 bg-card/40 backdrop-blur-sm shadow-sm">
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
        </div>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="p-10 h-full rounded-[2.5rem] border-border/40 bg-card/40 backdrop-blur-sm soft-shadow">
        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 mb-8 flex items-center gap-2">
          <IconSearch size={16} className="text-primary/60" />
          {t("logs.activity.log.title", "Activity Log")}
        </h3>
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground/40 text-sm bg-muted/10 rounded-3xl border border-dashed border-border/40">
          <IconActivity size={32} className="opacity-20 mb-4" />
          <p className="font-bold tracking-tight">
            {t("logs.activity.log.empty", "No activities for selected date")}
          </p>
        </div>
      </Card>
    );
  }

  // Stats
  const stats = {
    sessions: filteredItems.filter((i) => i.type === "session").length,
    executions: filteredItems.reduce((acc, item) => {
      if (item.type === "session") {
        return acc + item.session.executions.length;
      }
      return acc + 1;
    }, 0),
  };

  return (
    <Card className="p-10 h-full rounded-[2.5rem] border-border/40 bg-card/40 backdrop-blur-sm soft-shadow overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
          <IconSearch size={16} className="text-primary/60" />
          {t("logs.activity.log.title", "Activity Log")}
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary px-3 py-1 rounded-full shadow-sm">
            {stats.sessions} {t("logs.activity.log.sessions", "sessions")}
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 px-3 py-1 rounded-full shadow-sm">
            {stats.executions} {t("logs.activity.log.executions", "executions")}
          </span>
        </div>
      </div>

      <ActivityLogFilterBar filters={filters} onFiltersChange={setFilters} />

      <div className="flex-1 overflow-y-auto pr-2 -mr-2 mt-4 space-y-3">
        {filteredItems.map((item) => {
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
