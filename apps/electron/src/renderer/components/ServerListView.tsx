import React from "react";
import { MCPServer, Project } from "@mcp_router/shared";
import { ScrollArea } from "@mcp_router/ui";
import { Badge } from "@mcp_router/ui";
import { Switch } from "@mcp_router/ui";
import { useTranslation } from "react-i18next";
import { cn } from "@/renderer/utils/tailwind-utils";
import { AlertCircle, ChevronDown, Trash2 } from "lucide-react";
import { hasUnsetRequiredParams } from "@/renderer/utils/server-validation-utils";
import { toast } from "sonner";
import { showServerError } from "@/renderer/components/common";
import { UNASSIGNED_PROJECT_ID } from "../stores";

const STATUS_VISUALS = {
  running: { color: "bg-emerald-500", pulseEffect: "animate-pulse" },
  starting: { color: "bg-yellow-500", pulseEffect: "animate-pulse" },
  stopping: { color: "bg-orange-500", pulseEffect: "animate-pulse" },
  stopped: { color: "bg-muted-foreground", pulseEffect: "" },
  error: { color: "bg-red-500", pulseEffect: "animate-pulse" },
} as const;

const getStatusVisual = (
  status: string,
): (typeof STATUS_VISUALS)[keyof typeof STATUS_VISUALS] =>
  STATUS_VISUALS[status as keyof typeof STATUS_VISUALS] ||
  STATUS_VISUALS.stopped;

interface ServerListViewProps {
  filteredServers: MCPServer[];
  selectedProjectId: string | null;
  projects: Project[];
  collapsedByProjectId: Record<string, boolean>;
  setCollapsed: (id: string, collapsed: boolean) => void;
  onToggleExpand: (serverId: string) => void;
  onStartServer: (id: string) => Promise<void>;
  onStopServer: (id: string) => Promise<void>;
  onDeleteServer: (server: MCPServer, e: React.MouseEvent) => void;
}

export const ServerListView: React.FC<ServerListViewProps> = React.memo(
  ({
    filteredServers,
    selectedProjectId,
    projects,
    collapsedByProjectId,
    setCollapsed,
    onToggleExpand,
    onStartServer,
    onStopServer,
    onDeleteServer,
  }) => {
    const { t } = useTranslation();

    return (
      <ScrollArea className="h-full">
        <div className="divide-y divide-border">
          {/* Unassigned Section */}
          {(selectedProjectId === null ||
            selectedProjectId === UNASSIGNED_PROJECT_ID) &&
            (() => {
              const collapsed = !!collapsedByProjectId[UNASSIGNED_PROJECT_ID];
              const unassignedServers = filteredServers.filter(
                (s) => !s.projectId,
              );
              const isUnassignedCollapsible = selectedProjectId === null;
              const effectiveCollapsed = isUnassignedCollapsible && collapsed;
              const unassignedHeaderOnClick = isUnassignedCollapsible
                ? () => setCollapsed(UNASSIGNED_PROJECT_ID, !collapsed)
                : undefined;
              return (
                <div>
                  <div
                    className={cn(
                      "px-4 py-2.5 flex items-center justify-between bg-muted/40 backdrop-blur-sm sticky top-0 z-10 border-b border-border/10",
                      isUnassignedCollapsible && "cursor-pointer",
                    )}
                    onClick={unassignedHeaderOnClick}
                  >
                    <div className="flex items-center gap-2 text-sm font-bold text-primary/80">
                      {isUnassignedCollapsible && (
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 transition-transform duration-300",
                            collapsed ? "-rotate-90" : "rotate-0",
                          )}
                        />
                      )}
                      {t("projects.unassigned", {
                        defaultValue: "Unassigned",
                      })}
                    </div>
                    <div className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {unassignedServers.length}
                    </div>
                  </div>
                  {!effectiveCollapsed &&
                    unassignedServers.map((server) => (
                      <ServerListRow
                        key={server.id}
                        server={server}
                        onToggleExpand={onToggleExpand}
                        onStartServer={onStartServer}
                        onStopServer={onStopServer}
                        onDeleteServer={onDeleteServer}
                      />
                    ))}
                </div>
              );
            })()}

          {/* Project Sections */}
          {(selectedProjectId === null
            ? projects
            : projects.filter((p) => p.id === selectedProjectId)
          ).map((project) => {
            const sectionServers = filteredServers.filter(
              (s) => s.projectId === project.id,
            );
            if (sectionServers.length === 0) return null;
            const collapsed = !!collapsedByProjectId[project.id];
            const isProjectCollapsible = selectedProjectId === null;
            const effectiveCollapsed = isProjectCollapsible && collapsed;
            return (
              <div key={project.id}>
                <div
                  className={cn(
                    "px-4 py-2.5 flex items-center justify-between bg-muted/40 backdrop-blur-sm sticky top-0 z-10 border-b border-border/10",
                    isProjectCollapsible && "cursor-pointer",
                  )}
                  onClick={
                    isProjectCollapsible
                      ? () => setCollapsed(project.id, !collapsed)
                      : undefined
                  }
                >
                  <div className="flex items-center gap-2 text-sm font-bold text-primary/80">
                    {isProjectCollapsible && (
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform duration-300",
                          collapsed ? "-rotate-90" : "rotate-0",
                        )}
                      />
                    )}
                    {project.name}
                  </div>
                  <div className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {sectionServers.length}
                  </div>
                </div>
                {!effectiveCollapsed &&
                  sectionServers.map((server) => (
                    <ServerListRow
                      key={server.id}
                      server={server}
                      onToggleExpand={onToggleExpand}
                      onStartServer={onStartServer}
                      onStopServer={onStopServer}
                      onDeleteServer={onDeleteServer}
                    />
                  ))}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    );
  },
);

ServerListView.displayName = "ServerListView";

// Internal row component to reduce duplication between unassigned and project sections
const ServerListRow: React.FC<{
  server: MCPServer;
  onToggleExpand: (id: string) => void;
  onStartServer: (id: string) => Promise<void>;
  onStopServer: (id: string) => Promise<void>;
  onDeleteServer: (server: MCPServer, e: React.MouseEvent) => void;
}> = ({
  server,
  onToggleExpand,
  onStartServer,
  onStopServer,
  onDeleteServer,
}) => {
  const { t } = useTranslation();
  const status = getStatusVisual(server.status);

  return (
    <div className="px-2">
      <div
        className="p-4 my-1 hover:bg-primary/5 cursor-pointer rounded-xl transition-all duration-200 group"
        onClick={() => onToggleExpand(server.id)}
      >
        <div className="flex justify-between">
          <div className="flex flex-col">
            <div className="font-bold text-sm mb-1 group-hover:text-primary transition-colors">
              {server.name}
            </div>
            {server.description && (
              <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                {server.description}
              </p>
            )}
            <div className="flex flex-wrap gap-2 mb-1">
              <Badge
                variant="secondary"
                className="h-5 text-[10px] rounded-full px-2"
              >
                {server.serverType === "local" ? "Local" : "Remote"}
              </Badge>
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
                ></div>
                {t(`serverList.status.${server.status}`)}
              </Badge>
              {hasUnsetRequiredParams(server) && (
                <Badge
                  variant="destructive"
                  className="h-5 text-[10px] rounded-full px-2 flex items-center font-bold tracking-tight"
                  title={t("serverList.requiredParamsNotSet")}
                >
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {t("serverList.configRequired")}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-6 w-12 scale-90">
              <Switch
                checked={server.status === "running"}
                disabled={
                  server.status === "starting" ||
                  server.status === "stopping" ||
                  hasUnsetRequiredParams(server)
                }
                onCheckedChange={async (checked) => {
                  try {
                    if (checked) {
                      await onStartServer(server.id);
                      toast.success(t("serverList.serverStarted"));
                    } else {
                      await onStopServer(server.id);
                      toast.success(t("serverList.serverStopped"));
                    }
                  } catch (error) {
                    showServerError(
                      error instanceof Error ? error : new Error(String(error)),
                      server.name,
                    );
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>
            <button
              className="p-2 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all duration-200"
              onClick={(e) => onDeleteServer(server, e)}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
