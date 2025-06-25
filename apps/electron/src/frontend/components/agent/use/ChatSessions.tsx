import React from "react";
import { Button } from "@mcp-router/ui";
import { Trash2, Plus, MoreHorizontal, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/tailwind-utils";
import { getDateInstance } from "@/lib/utils/date-utils";
import { Skeleton } from "@mcp-router/ui";
import { Tooltip, TooltipTrigger, TooltipContent } from "@mcp-router/ui";
import { useTranslation } from "react-i18next";

interface ChatSession {
  id: string;
  lastMessage?: string;
  createdAt: number; // Unix timestamp
}

interface ChatSessionsProps {
  currentSessionId?: string;
  onSessionSelect: (sessionId: string | null) => void;
  onNewSession: () => void;
  sessions: ChatSession[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  onLoadMore: () => void;
  onDeleteSession: (sessionId: string) => void;
  deletingSessions?: Set<string>;
}

/**
 * チャットセッション一覧コンポーネント
 */
const ChatSessions: React.FC<ChatSessionsProps> = ({
  currentSessionId,
  onSessionSelect,
  onNewSession,
  sessions,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  onLoadMore,
  onDeleteSession,
  deletingSessions = new Set(),
}) => {
  const { t } = useTranslation();
  // 日時をフォーマット
  const formatDateTime = (timestamp: number) => {
    const date = getDateInstance(timestamp);
    const now = getDateInstance();
    const diffInHours = now.diff(date, "hour");

    if (diffInHours < 24) {
      return date.format("HH:mm");
    } else if (diffInHours < 24 * 7) {
      return date.format("M/D");
    } else {
      return date.format("YYYY/M/D");
    }
  };

  return (
    <div className="w-full border-b bg-card/50">
      <div className="flex items-center p-3">
        {/* Label and New Button */}
        <div className="flex items-center gap-2 shrink-0 mr-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                onClick={onNewSession}
                className="h-7 text-xs"
                variant="outline"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("agents.sessions.newSession")}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Horizontal Sessions List */}
        <div className="flex-1 relative overflow-hidden">
          {isLoading && sessions.length === 0 ? (
            <div className="overflow-x-auto">
              <div className="flex items-center gap-2 min-w-max">
                {/* Skeleton items for loading state */}
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={`skeleton-${i}`}
                    className="flex items-center gap-2 px-3 py-2 rounded-md border border-transparent shrink-0"
                  >
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="text-center">
              <div className="text-xs text-red-500">{error}</div>
            </div>
          ) : sessions.length === 0 ? (
            <div></div>
          ) : (
            <div className="overflow-x-auto">
              <div className="flex items-center gap-2 min-w-max">
                {sessions.map((session) => {
                  const isDeleting = deletingSessions.has(session.id);
                  return (
                    <div
                      key={session.id}
                      className={cn(
                        "group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors border whitespace-nowrap shrink-0",
                        currentSessionId === session.id
                          ? "bg-primary/10 border-primary/20"
                          : "hover:bg-muted/50 border-transparent",
                        isDeleting && "opacity-50",
                      )}
                      onClick={() => !isDeleting && onSessionSelect(session.id)}
                    >
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(session.createdAt)}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 p-0 ml-1"
                        disabled={isDeleting}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isDeleting) {
                            onDeleteSession(session.id);
                          }
                        }}
                      >
                        {isDeleting ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  );
                })}

                {/* Load More Button */}
                {hasMore && (
                  <Button
                    variant="ghost"
                    onClick={onLoadMore}
                    disabled={isLoadingMore}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground shrink-0"
                    title={
                      isLoadingMore
                        ? t("agents.sessions.loading")
                        : t("agents.sessions.loadMore")
                    }
                  >
                    {isLoadingMore ? (
                      <div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                    ) : (
                      <MoreHorizontal className="h-3 w-3" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatSessions;
