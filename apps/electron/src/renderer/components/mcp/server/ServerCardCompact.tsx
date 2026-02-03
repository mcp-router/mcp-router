import React from "react";
import { MCPServer } from "@mcp_router/shared";
import { Card, CardContent } from "@mcp_router/ui";
import { Badge } from "@mcp_router/ui";
import { Switch } from "@mcp_router/ui";
import { Button } from "@mcp_router/ui";
import { AlertCircle, Trash2 } from "lucide-react";
import { cn } from "@/renderer/utils/tailwind-utils";
import { useTranslation } from "react-i18next";
import { hasUnsetRequiredParams } from "@/renderer/utils/server-validation-utils";

interface ServerCardCompactProps {
  server: MCPServer;
  onToggle: (checked: boolean) => void;
  onDelete?: () => void;
  onError: (e: React.MouseEvent) => void;
  onClick: () => void;
  isExpanded: boolean;
}

export const ServerCardCompact: React.FC<ServerCardCompactProps> = ({
  server,
  onToggle,
  onDelete,
  onError,
  onClick,
  isExpanded,
}) => {
  const { t } = useTranslation();

  const statusConfig = {
    running: {
      color: "bg-emerald-500",
      pulseEffect: "animate-pulse",
    },
    starting: {
      color: "bg-yellow-500",
      pulseEffect: "animate-pulse",
    },
    stopping: {
      color: "bg-orange-500",
      pulseEffect: "animate-pulse",
    },
    stopped: {
      color: "bg-muted-foreground",
      pulseEffect: "",
    },
    error: {
      color: "bg-red-500",
      pulseEffect: "animate-pulse",
    },
  };

  const status =
    statusConfig[server.status as keyof typeof statusConfig] ||
    statusConfig.stopped;

  return (
    <Card
      className={cn(
        "hover:border-primary/50 transition-all duration-300 cursor-pointer rounded-2xl soft-shadow hover:-translate-y-0.5",
        isExpanded && "border-primary ring-2 ring-primary/10",
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-bold text-sm truncate tracking-tight">
                {server.name}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant="outline"
                className={cn(
                  "h-5 text-[10px] rounded-full px-2 font-bold tracking-tight border-border/40",
                  status.pulseEffect,
                )}
              >
                <div
                  className={cn(
                    "h-1.5 w-1.5 rounded-full mr-1.5",
                    status.color,
                  )}
                />
                {t(`serverList.status.${server.status}`)}
              </Badge>
              {server.serverType === "remote" && (
                <Badge
                  variant="secondary"
                  className="h-5 text-[10px] rounded-full px-2 font-bold tracking-tight"
                >
                  Remote
                </Badge>
              )}
              {hasUnsetRequiredParams(server) && (
                <Badge
                  variant="destructive"
                  className="h-5 text-[10px] rounded-full px-2 flex items-center font-bold tracking-tight"
                  title={t("serverList.requiredParamsNotSet")}
                >
                  <AlertCircle className="h-2.5 w-2.5 mr-1 flex-shrink-0" />
                  <span className="truncate">
                    {t("serverList.configRequired")}
                  </span>
                </Badge>
              )}
            </div>
          </div>

          <div
            className="flex items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {server.status === "error" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onError(e);
                }}
              >
                <AlertCircle className="h-4 w-4 text-destructive" />
              </Button>
            )}

            <Switch
              checked={server.status === "running"}
              disabled={
                server.status === "starting" ||
                server.status === "stopping" ||
                hasUnsetRequiredParams(server)
              }
              title={
                hasUnsetRequiredParams(server)
                  ? t("serverList.requiredParamsNotSet")
                  : undefined
              }
              onCheckedChange={onToggle}
              className="data-[state=checked]:bg-emerald-500"
            />

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation();
                if (typeof onDelete === "function") onDelete();
              }}
              title={t("serverSettings.delete", {
                defaultValue: "Delete Server",
              })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
