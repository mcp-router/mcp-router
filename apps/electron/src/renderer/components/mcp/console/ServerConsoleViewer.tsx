import React, { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Card, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@mcp_router/ui";
import { IconTrash, IconRefresh, IconDownload } from "@tabler/icons-react";
import { useServerStore } from "@/renderer/stores";

interface ConsoleLogEntry {
  serverId: string;
  serverName: string;
  timestamp: string;
  type: "stdout" | "stderr";
  content: string;
}

const ServerConsoleViewer: React.FC = () => {
  const { t } = useTranslation();
  const { servers } = useServerStore();
  const [selectedServerId, setSelectedServerId] = useState<string>("all");
  const [logs, setLogs] = useState<Record<string, ConsoleLogEntry[]>>({});
  const [loading, setLoading] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Get running servers
  const runningServers = Array.from(servers.values()).filter(
    (server) => server.status === "running" || server.status === "starting",
  );

  // Load logs for all servers or a specific server
  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.getConsoleLogs(
        selectedServerId === "all" ? undefined : selectedServerId,
      );
      
      // Handle both array and object return types
      if (selectedServerId === "all") {
        // Should be an object with serverId keys
        if (Array.isArray(result)) {
          // Convert array to object grouped by serverId
          const logsObj: Record<string, ConsoleLogEntry[]> = {};
          result.forEach((log) => {
            if (!logsObj[log.serverId]) {
              logsObj[log.serverId] = [];
            }
            logsObj[log.serverId].push(log);
          });
          setLogs(logsObj);
        } else {
          setLogs(result || {});
        }
      } else {
        // Should be an array for a specific server
        const logArray = Array.isArray(result) ? result : [];
        setLogs({ [selectedServerId]: logArray });
      }
    } catch (error) {
      console.error("Failed to load console logs:", error);
      setLogs({});
    } finally {
      setLoading(false);
    }
  }, [selectedServerId]);

  // Initial load when selectedServerId changes
  useEffect(() => {
    loadLogs();
  }, [selectedServerId]); // Only reload when server selection changes

  // Subscribe to real-time log updates
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    try {
      // Subscribe to log updates
      unsubscribe = window.electronAPI.onConsoleLog(
        (logEntry: ConsoleLogEntry) => {
          setLogs((prevLogs) => {
            const serverId = logEntry.serverId;
            const serverLogs = prevLogs[serverId] || [];
            return {
              ...prevLogs,
              [serverId]: [...serverLogs, logEntry],
            };
          });

          // Auto-scroll if enabled
          if (autoScroll && logContainerRef.current) {
            requestAnimationFrame(() => {
              if (logContainerRef.current) {
                logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
              }
            });
          }
        },
        selectedServerId === "all" ? undefined : selectedServerId,
      );
    } catch (error) {
      console.error("Failed to subscribe to console logs:", error);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [selectedServerId, autoScroll]); // Only resubscribe when server selection or autoScroll changes

  // Auto-scroll to bottom when logs change
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        if (logContainerRef.current) {
          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
      });
    }
  }, [logs, autoScroll]);

  // Clear logs for selected server
  const handleClearLogs = async () => {
    try {
      await window.electronAPI.clearConsoleLogs(
        selectedServerId === "all" ? undefined : selectedServerId,
      );
      await loadLogs();
    } catch (error) {
      console.error("Failed to clear logs:", error);
    }
  };

  // Export logs
  const handleExportLogs = () => {
    const logsToExport =
      selectedServerId === "all"
        ? Object.values(logs).flat()
        : logs[selectedServerId] || [];

    const logText = logsToExport
      .map(
        (log) =>
          `[${new Date(log.timestamp).toLocaleString()}] [${log.type.toUpperCase()}] ${log.serverName}: ${log.content}`,
      )
      .join("\n");

    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mcp-console-logs-${selectedServerId}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Get logs to display
  const displayLogs =
    selectedServerId === "all"
      ? Object.values(logs).flat().sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      : logs[selectedServerId] || [];

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">
          {t("serverConsole.title", "Server Console")}
        </h1>
        <p className="text-muted-foreground">
          {t(
            "serverConsole.description",
            "View console output from all running MCP servers",
          )}
        </p>
      </div>

      {/* Controls */}
      <div className="flex gap-4 mb-4 items-center">
        <Select value={selectedServerId} onValueChange={setSelectedServerId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t("serverConsole.selectServer", "Select Server")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("serverConsole.allServers", "All Servers")}
            </SelectItem>
            {runningServers.map((server) => (
              <SelectItem key={server.id} value={server.id}>
                {server.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
          <IconRefresh className="h-4 w-4 mr-2" />
          {t("common.refresh", "Refresh")}
        </Button>

        <Button variant="outline" size="sm" onClick={handleClearLogs}>
          <IconTrash className="h-4 w-4 mr-2" />
          {t("common.clear", "Clear")}
        </Button>

        <Button variant="outline" size="sm" onClick={handleExportLogs}>
          <IconDownload className="h-4 w-4 mr-2" />
          {t("serverConsole.export", "Export")}
        </Button>

        <label className="flex items-center gap-2 ml-auto">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm">
            {t("serverConsole.autoScroll", "Auto-scroll")}
          </span>
        </label>
      </div>

      {/* Console Output */}
      <Card className="flex-1 overflow-hidden p-0">
        <div
          ref={logContainerRef}
          className="h-full overflow-auto p-4 bg-black text-green-400 font-mono text-sm"
          style={{ fontFamily: "monospace" }}
        >
          {loading && displayLogs.length === 0 ? (
            <div className="text-muted-foreground">
              {t("serverConsole.loading", "Loading...")}
            </div>
          ) : displayLogs.length === 0 ? (
            <div className="text-muted-foreground">
              {selectedServerId === "all"
                ? t(
                    "serverConsole.noLogs",
                    "No console output available. Start a server to see its output.",
                  )
                : t(
                    "serverConsole.noLogsForServer",
                    "No console output available for this server.",
                  )}
            </div>
          ) : (
            displayLogs.map((log, index) => {
              const timestamp = new Date(log.timestamp).toLocaleTimeString();
              const isError = log.type === "stderr";
              const serverLabel =
                selectedServerId === "all" ? `[${log.serverName}]` : "";

              return (
                <div
                  key={`${log.serverId}-${index}-${log.timestamp}`}
                  className={`mb-1 ${isError ? "text-red-400" : "text-green-400"}`}
                >
                  <span className="text-gray-500">{timestamp}</span>
                  {serverLabel && (
                    <span className="text-blue-400 ml-2">{serverLabel}</span>
                  )}
                  <span className={`ml-2 ${isError ? "text-red-400" : ""}`}>
                    {log.content}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
};

export default ServerConsoleViewer;
