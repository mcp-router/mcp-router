import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { usePlatformAPI } from "@mcp-router/platform-api";
import { Terminal, RefreshCw, FileText } from "lucide-react";
import { ScrollArea } from "@mcp-router/ui";
import { Switch } from "@mcp-router/ui";
import { Label } from "@mcp-router/ui";
import { Button } from "@mcp-router/ui";
import { toast } from "sonner";

interface ServerDetailsLogsProps {
  serverName: string;
  serverId: string;
  serverStatus: string;
}

const ServerDetailsLogs: React.FC<ServerDetailsLogsProps> = ({
  serverName,
  serverId,
  serverStatus,
}) => {
  const { t } = useTranslation();
  const platformAPI = usePlatformAPI();
  const [logs, setLogs] = useState<string[]>([]);
  const [isLogLoading, setIsLogLoading] = useState(false);
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(false);

  const fetchLogs = async () => {
    setIsLogLoading(true);
    try {
      const response = await platformAPI.logs.query({
        limit: 100,
        offset: 0,
      });

      if (response && response.logs) {
        const filtered = response.logs.filter(
          (log) => log.serverName === serverName,
        );
        const formattedLogs = filtered.map((log) => {
          const timestamp = new Date(log.timestamp).toLocaleTimeString();
          const duration = log.duration ? `(${log.duration}ms)` : "";
          const clientInfo = log.clientName
            ? `from ${log.clientName}`
            : log.clientId
              ? `from client ${log.clientId}`
              : "";
          const statusStyle =
            log.responseStatus === "success" ? "SUCCESS" : "ERROR";
          const errorInfo = log.errorMessage ? `: ${log.errorMessage}` : "";

          return `[${timestamp}] ${log.requestType} ${clientInfo} ${duration} - ${statusStyle}${errorInfo}`;
        });
        setLogs(formattedLogs.reverse());
      }
    } catch (error) {
      console.error("Failed to fetch request logs:", error);
      toast.error(t("serverDetails.failedToFetchLogs"));
    } finally {
      setIsLogLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();

    let intervalId: NodeJS.Timeout | null = null;
    if (autoRefreshLogs && serverStatus === "running") {
      intervalId = setInterval(fetchLogs, 2000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [serverName, serverId, autoRefreshLogs, serverStatus]);

  const handleRefresh = () => {
    setLogs([]);
    fetchLogs();
    toast.success(t("serverDetails.logsRefreshed"));
  };

  return (
    <div className="bg-muted border border-border rounded-lg shadow-inner overflow-hidden">
      <div className="flex justify-between items-center px-4 py-2 border-b border-border">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5" />
          {t("serverDetails.requestLogs")}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-5 items-center space-x-2 text-xs">
              <Switch
                id="auto-refresh"
                checked={autoRefreshLogs}
                onCheckedChange={setAutoRefreshLogs}
                disabled={serverStatus !== "running"}
              />
              <Label
                htmlFor="auto-refresh"
                className="text-foreground cursor-pointer"
              >
                {t("serverDetails.autoRefresh")}
              </Label>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={handleRefresh}
            disabled={isLogLoading}
          >
            <RefreshCw
              className={`h-4 w-4 ${isLogLoading ? "animate-spin" : ""}`}
            />
          </Button>
          <div className="flex space-x-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
          </div>
        </div>
      </div>
      <ScrollArea className="h-[350px] font-mono text-sm">
        <div className="p-4">
          {logs.length > 0 ? (
            logs.map((log, index) => (
              <div
                key={index}
                className="py-0.5 border-l-2 border-transparent pl-2 hover:border-primary hover:bg-muted/50 rounded transition-colors break-all whitespace-pre-wrap text-foreground"
              >
                {log}
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-[290px] text-muted-foreground italic">
              <FileText className="w-12 h-12 mb-3 opacity-30" />
              <div>{t("serverDetails.noRequestLogs")}</div>
              <div className="text-xs mt-1 opacity-75">
                {t("serverDetails.serverNeedsToBeStarted")}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ServerDetailsLogs;
