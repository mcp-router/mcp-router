import React from "react";
import { MCPServer, Project } from "@mcp_router/shared";
import { ScrollArea } from "@mcp_router/ui";
import { useTranslation } from "react-i18next";
import { cn } from "@/renderer/utils/tailwind-utils";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { showServerError } from "@/renderer/components/common";
import { ServerCardCompact } from "@/renderer/components/mcp/server/ServerCardCompact";
import { UNASSIGNED_PROJECT_ID } from "../stores";

interface ServerGridViewProps {
  filteredServers: MCPServer[];
  selectedProjectId: string | null;
  projects: Project[];
  collapsedByProjectId: Record<string, boolean>;
  setCollapsed: (id: string, collapsed: boolean) => void;
  expandedServerId: string | null;
  onToggleExpand: (serverId: string) => void;
  onStartServer: (id: string) => Promise<void>;
  onStopServer: (id: string) => Promise<void>;
  onRequestDelete: (server: MCPServer) => void;
  onError: (server: MCPServer, e: React.MouseEvent) => void;
}

export const ServerGridView: React.FC<ServerGridViewProps> = ({
  filteredServers,
  selectedProjectId,
  projects,
  collapsedByProjectId,
  setCollapsed,
  expandedServerId,
  onToggleExpand,
  onStartServer,
  onStopServer,
  onRequestDelete,
  onError,
}) => {
  const { t } = useTranslation();

  const handleToggle = async (server: MCPServer, checked: boolean) => {
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
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Unassigned section Grid */}
        {(selectedProjectId === null ||
          selectedProjectId === UNASSIGNED_PROJECT_ID) &&
          (() => {
            const collapsed = collapsedByProjectId[UNASSIGNED_PROJECT_ID];
            const unassignedServers = filteredServers.filter(
              (s) => !s.projectId,
            );
            if (unassignedServers.length === 0) return null;
            const isUnassignedCollapsible = selectedProjectId === null;
            const effectiveCollapsed =
              isUnassignedCollapsible && collapsed;
            return (
              <div>
                <div
                  className={cn(
                    "px-3 py-2 flex items-center justify-between bg-muted/30 rounded-full mb-3 border border-border/10",
                    isUnassignedCollapsible && "cursor-pointer",
                  )}
                  onClick={
                    isUnassignedCollapsible
                      ? () =>
                          setCollapsed(UNASSIGNED_PROJECT_ID, !collapsed)
                      : undefined
                  }
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-primary/70 uppercase tracking-widest ml-1">
                    {isUnassignedCollapsible && (
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform duration-300",
                          collapsed ? "-rotate-90" : "rotate-0",
                        )}
                      />
                    )}
                    {t("projects.unassigned", {
                      defaultValue: "Unassigned",
                    })}
                  </div>
                  <div className="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full mr-1">
                    {unassignedServers.length}
                  </div>
                </div>
                {!effectiveCollapsed && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {unassignedServers.map((server) => (
                      <ServerCardCompact
                        key={server.id}
                        server={server}
                        isExpanded={expandedServerId === server.id}
                        onClick={() => onToggleExpand(server.id)}
                        onToggle={(checked) => handleToggle(server, checked)}
                        onDelete={() => onRequestDelete(server)}
                        onError={(e) => onError(server, e)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

        {/* Project sections Grid */}
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
            <div key={project.id} className="pt-2">
              <div
                className={cn(
                  "px-3 py-2 flex items-center justify-between bg-muted/30 rounded-full mb-3 border border-border/10",
                  isProjectCollapsible && "cursor-pointer",
                )}
                onClick={
                  isProjectCollapsible
                    ? () => setCollapsed(project.id, !collapsed)
                    : undefined
                }
              >
                <div className="flex items-center gap-2 text-xs font-bold text-primary/70 uppercase tracking-widest ml-1">
                  {isProjectCollapsible && (
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform duration-300",
                        collapsed ? "-rotate-90" : "rotate-0",
                      )}
                    />
                  )}
                  {project.name}
                </div>
                <div className="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full mr-1">
                  {sectionServers.length}
                </div>
              </div>
              {!effectiveCollapsed && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {sectionServers.map((server) => (
                    <ServerCardCompact
                      key={server.id}
                      server={server}
                      isExpanded={expandedServerId === server.id}
                      onClick={() => onToggleExpand(server.id)}
                      onToggle={(checked) => handleToggle(server, checked)}
                      onDelete={() => onRequestDelete(server)}
                      onError={(e) => onError(server, e)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
};
