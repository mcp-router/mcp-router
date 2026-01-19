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
  onError: () => void;
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
        "hover:border-primary/50 transition-colors cursor-pointer",
        isExpanded && "border-primary",
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-sm truncate">{server.name}</h3>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Badge
                variant="outline"
                className={cn("h-5 text-xs", status.pulseEffect)}
              >
                <div
                  className={cn("h-2 w-2 rounded-full mr-1", status.color)}
                />
                {t(`serverList.status.${server.status}`)}
              </Badge>
              {server.serverType === "remote" && (
                <Badge variant="secondary" className="h-5 text-xs">
                  Remote
                </Badge>
              )}
              {hasUnsetRequiredParams(server) && (
                <Badge
                  variant="destructive"
                  className="h-5 text-xs flex items-center"
                  title={t("serverList.requiredParamsNotSet")}
                >
                  <AlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
                  <span className="truncate">
                    {t("serverList.configRequired")}
                  </span>
                </Badge>
              )}
            </div>
          </div>

          <div
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {server.status === "error" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onError();
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
              className="data-[state=checked]:bg-primary"
            />

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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
