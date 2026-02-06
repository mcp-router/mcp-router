import React, { useState } from "react";
import { MCPServer, ProjectOptimization } from "@mcp_router/shared";
import { ScrollArea } from "@mcp_router/ui";
import { Badge } from "@mcp_router/ui";
import { Switch } from "@mcp_router/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@mcp_router/ui";
import {
  IconSearch,
  IconServer,
  IconPlus,
  IconUpload,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/renderer/utils/tailwind-utils";
import {
  AlertCircle,
  Grid3X3,
  List,
  Settings as SettingsIcon,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { hasUnsetRequiredParams } from "@/renderer/utils/server-validation-utils";
import { toast } from "sonner";
import {
  useServerStore,
  useWorkspaceStore,
  useAuthStore,
  useViewPreferencesStore,
  useProjectStore,
  UNASSIGNED_PROJECT_ID,
} from "../stores";
import { showServerError } from "@/renderer/components/common";

// Import components
import { ServerErrorModal } from "@/renderer/components/common/ServerErrorModal";
import { ServerCardCompact } from "@/renderer/components/mcp/server/ServerCardCompact";
import { Link } from "react-router-dom";
import { Button } from "@mcp_router/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@mcp_router/ui";
import { LoginScreen } from "@/renderer/components/auth/LoginScreen";
import ServerDetailsAdvancedSheet from "@/renderer/components/mcp/server/server-details/ServerDetailsAdvancedSheet";
import { useServerEditingStore } from "@/renderer/stores";
import { ProjectSettingsModal } from "@/renderer/components/mcp/server/ProjectSettingsModal";

const STATUS_VISUALS = {
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
} as const;

const getStatusVisual = (
  status: string,
): (typeof STATUS_VISUALS)[keyof typeof STATUS_VISUALS] => {
  return (
    STATUS_VISUALS[status as keyof typeof STATUS_VISUALS] ||
    STATUS_VISUALS.stopped
  );
};

const Home: React.FC = () => {
  const { t } = useTranslation();

  // Zustand stores
  const {
    servers,
    searchQuery,
    setSearchQuery,
    expandedServerId,
    startServer,
    stopServer,
    deleteServer,
    refreshServers,
    updateServerConfig,
    updateServerToolPermissions,
  } = useServerStore();

  // Get workspace and auth state
  const { currentWorkspace } = useWorkspaceStore();
  const { isAuthenticated, login } = useAuthStore();
  const { serverViewMode, setServerViewMode } = useViewPreferencesStore();
  const {
    projects,
    list: listProjects,
    create: createProject,
    update: updateProjectInStore,
    delete: deleteProjectInStore,
    collapsedByProjectId,
    setCollapsed,
    selectedProjectId,
    setSelectedProjectId,
  } = useProjectStore();

  // Filter servers based on search query, project selection and sort them
  const filteredServers = React.useMemo(() => {
    const base = servers
      .filter((server) =>
        server.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    if (selectedProjectId === UNASSIGNED_PROJECT_ID) {
      return base.filter((s) => !s.projectId);
    }
    if (selectedProjectId) {
      return base.filter((s) => s.projectId === selectedProjectId);
    }
    return base;
  }, [servers, searchQuery, selectedProjectId]);

  const [isHomeSettingsOpen, setIsHomeSettingsOpen] = useState(false);

  // State for error modal
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorServer, setErrorServer] = useState<MCPServer | null>(null);

  // State for Advanced Settings
  const [advancedSettingsServer, setAdvancedSettingsServer] =
    useState<MCPServer | null>(null);
  const { initializeFromServer, setIsAdvancedEditing } =
    useServerEditingStore();

  // State for delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serverToDelete, setServerToDelete] = useState<MCPServer | null>(null);

  // Toggle expanded server details - open settings
  const toggleServerExpand = (serverId: string) => {
    const server = servers.find((s) => s.id === serverId);
    if (server) {
      initializeFromServer(server);
      setAdvancedSettingsServer(server);
      setIsAdvancedEditing(true);
    }
  };

  // Handle server delete - open confirmation dialog
  const handleDeleteServer = (server: MCPServer, e: React.MouseEvent) => {
    e.stopPropagation();
    setServerToDelete(server);
    setDeleteDialogOpen(true);
  };

  // Confirm and execute server deletion
  const confirmDeleteServer = async () => {
    if (!serverToDelete) return;
    try {
      await deleteServer(serverToDelete.id);
      toast.success(t("serverDetails.removeSuccess"));
    } catch (_error) {
      toast.error(t("serverDetails.removeFailed"));
    } finally {
      setDeleteDialogOpen(false);
      setServerToDelete(null);
    }
  };

  // Load projects on workspace change
  React.useEffect(() => {
    listProjects().catch((e) => console.error("Failed to load projects", e));
  }, [listProjects, currentWorkspace?.id]);

  // Handle opening error modal
  const openErrorModal = (server: MCPServer, e: React.MouseEvent) => {
    e.stopPropagation();
    setErrorServer(server);
    setErrorModalOpen(true);
  };

  // Handle export servers
  const exportServersToFile = React.useCallback(() => {
    // Convert servers array to mcpServers object format
    const mcpServers: Record<string, unknown> = {};

    servers.forEach((server) => {
      mcpServers[server.name] = {
        command: server.command,
        args: server.args || [],
        env: server.env || {},
      };
    });

    const exportData = {
      mcpServers: mcpServers,
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri =
      "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

    const exportFileDefaultName = `mcp-servers-${new Date().toISOString().split("T")[0]}.json`;

    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  }, [servers]);

  const handleCreateProject = React.useCallback(
    async (input: { name: string }) => {
      return await createProject(input);
    },
    [createProject],
  );

  const handleRenameProject = React.useCallback(
    async (id: string, updates: { name: string }) => {
      return await updateProjectInStore(id, updates);
    },
    [updateProjectInStore],
  );

  const handleDeleteProject = React.useCallback(
    async (id: string) => {
      await deleteProjectInStore(id);
      await refreshServers();
    },
    [deleteProjectInStore, refreshServers],
  );

  const handleUpdateProjectOptimization = React.useCallback(
    async (id: string, optimization: ProjectOptimization) => {
      return await updateProjectInStore(id, { optimization });
    },
    [updateProjectInStore],
  );

  // Show login screen for remote workspaces if not authenticated
  if (currentWorkspace?.type === "remote" && !isAuthenticated) {
    return <LoginScreen onLogin={login} />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6 flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsHomeSettingsOpen(true)}
          className="gap-1 rounded-full px-4 h-9"
          title={t("projects.projectSettings", {
            defaultValue: "Project Settings",
          })}
        >
          <SettingsIcon className="h-4 w-4" />
        </Button>
        <div className="w-40">
          <Select
            value={selectedProjectId === null ? "__all__" : selectedProjectId}
            onValueChange={(value) =>
              setSelectedProjectId(value === "__all__" ? null : value)
            }
          >
            <SelectTrigger className="h-9 rounded-full px-4">
              <SelectValue
                placeholder={t("projects.all", { defaultValue: "All" })}
              />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="__all__">
                {t("projects.all", { defaultValue: "All" })}
              </SelectItem>
              <SelectItem value={UNASSIGNED_PROJECT_ID}>
                {t("projects.unassigned", { defaultValue: "Unassigned" })}
              </SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("common.search")}
            className="w-full bg-background border border-border rounded-full py-2 px-4 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <IconSearch className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex bg-muted/30 p-1 rounded-full gap-1 border border-border/40">
          <Button
            variant={serverViewMode === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => setServerViewMode("list")}
            className="h-8 w-8 p-0 rounded-full"
            title="List View"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={serverViewMode === "grid" ? "default" : "ghost"}
            size="sm"
            onClick={() => setServerViewMode("grid")}
            className="h-8 w-8 p-0 rounded-full"
            title="Grid View"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={exportServersToFile}
          className="gap-1 rounded-full h-9 w-9 p-0"
          title="Export"
        >
          <IconUpload className="h-4 w-4" />
        </Button>
        <Button
          asChild
          variant="default"
          size="sm"
          className="gap-1 rounded-full h-9 px-4"
        >
          <Link to="/servers/add">
            <IconPlus className="h-4 w-4" />
            <span className="font-semibold text-xs">Add Server</span>
          </Link>
        </Button>
      </div>

      <div
        className={cn(
          "flex-1 mb-8",
          serverViewMode === "list" &&
            "border border-border/50 rounded-2xl overflow-hidden bg-card/30 backdrop-blur-sm shadow-sm",
        )}
      >
        {filteredServers.length === 0 && searchQuery === "" ? (
          <div className="p-4 flex items-center justify-center">
            <div className="text-center">
              <IconServer className="w-16 h-16 mx-auto mb-4 opacity-40" />
              <div className="text-base font-medium mb-2">
                {t("serverList.noServers")}
              </div>
              <div className="text-sm opacity-75">
                <Link to="/servers/add">{t("serverList.addServer")}</Link>
              </div>
            </div>
          </div>
        ) : filteredServers.length === 0 && searchQuery !== "" ? (
          <div className="p-4 flex items-center justify-center">
            <div className="text-center">
              <IconSearch className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <div className="text-base font-medium mb-2">
                {t("common.search")}
              </div>
              <div className="text-sm opacity-75">
                {t("serverList.noServers")}
              </div>
            </div>
          </div>
        ) : serverViewMode === "list" ? (
          <ScrollArea className="h-full">
            <div className="divide-y divide-border">
              {/* Unassigned Section */}
              {(selectedProjectId === null ||
                selectedProjectId === UNASSIGNED_PROJECT_ID) &&
                (() => {
                  const collapsed =
                    !!collapsedByProjectId[UNASSIGNED_PROJECT_ID];
                  const unassignedServers = filteredServers.filter(
                    (s) => !s.projectId,
                  );
                  const isUnassignedCollapsible = selectedProjectId === null;
                  const effectiveCollapsed =
                    isUnassignedCollapsible && collapsed;
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
                        unassignedServers.map((server) => {
                          const status = getStatusVisual(server.status);
                          return (
                            <div key={server.id} className="px-2">
                              <div
                                className="p-4 my-1 hover:bg-primary/5 cursor-pointer rounded-xl transition-all duration-200 group"
                                onClick={() => toggleServerExpand(server.id)}
                              >
                                <div className="flex justify-between">
                                  <div className="flex flex-col">
                                    <div className="font-bold text-sm mb-1 group-hover:text-primary transition-colors">
                                      {server.name}
                                    </div>
                                    {"description" in server &&
                                      typeof (server as any).description ===
                                        "string" && (
                                        <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                                          {(server as any).description}
                                        </p>
                                      )}
                                    <div className="flex flex-wrap gap-2 mb-1">
                                      <Badge
                                        variant="secondary"
                                        className="h-5 text-[10px] rounded-full px-2"
                                      >
                                        {server.serverType === "local"
                                          ? "Local"
                                          : "Remote"}
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
                                        {t(
                                          `serverList.status.${server.status}`,
                                        )}
                                      </Badge>
                                      {hasUnsetRequiredParams(server) && (
                                        <Badge
                                          variant="destructive"
                                          className="h-5 text-[10px] rounded-full px-2 flex items-center font-bold tracking-tight"
                                          title={t(
                                            "serverList.requiredParamsNotSet",
                                          )}
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
                                              await startServer(server.id);
                                              toast.success(
                                                t("serverList.serverStarted"),
                                              );
                                            } else {
                                              await stopServer(server.id);
                                              toast.success(
                                                t("serverList.serverStopped"),
                                              );
                                            }
                                          } catch (error) {
                                            showServerError(
                                              error instanceof Error
                                                ? error
                                                : new Error(String(error)),
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
                                      onClick={(e) =>
                                        handleDeleteServer(server, e)
                                      }
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
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
                      sectionServers.map((server) => {
                        const status = getStatusVisual(server.status);
                        return (
                          <div key={server.id} className="px-2">
                            <div
                              className="p-4 my-1 hover:bg-primary/5 cursor-pointer rounded-xl transition-all duration-200 group"
                              onClick={() => toggleServerExpand(server.id)}
                            >
                              <div className="flex justify-between">
                                <div className="flex flex-col">
                                  <div className="font-bold text-sm mb-1 group-hover:text-primary transition-colors">
                                    {server.name}
                                  </div>
                                  <div className="flex flex-wrap gap-2 mb-1">
                                    <Badge
                                      variant="secondary"
                                      className="h-5 text-[10px] rounded-full px-2"
                                    >
                                      {server.serverType === "local"
                                        ? "Local"
                                        : "Remote"}
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
                                      />
                                      {t(`serverList.status.${server.status}`)}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="h-6 w-12 scale-90">
                                    <Switch
                                      checked={server.status === "running"}
                                      onCheckedChange={async (checked) => {
                                        try {
                                          if (checked) {
                                            await startServer(server.id);
                                            toast.success(
                                              t("serverList.serverStarted"),
                                            );
                                          } else {
                                            await stopServer(server.id);
                                            toast.success(
                                              t("serverList.serverStopped"),
                                            );
                                          }
                                        } catch (error) {
                                          showServerError(
                                            error instanceof Error
                                              ? error
                                              : new Error(String(error)),
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
                                    onClick={(e) =>
                                      handleDeleteServer(server, e)
                                    }
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
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
                              onClick={() => toggleServerExpand(server.id)}
                              onToggle={async (checked) => {
                                try {
                                  if (checked) {
                                    await startServer(server.id);
                                    toast.success(
                                      t("serverList.serverStarted"),
                                    );
                                  } else {
                                    await stopServer(server.id);
                                    toast.success(
                                      t("serverList.serverStopped"),
                                    );
                                  }
                                } catch (error) {
                                  showServerError(
                                    error instanceof Error
                                      ? error
                                      : new Error(String(error)),
                                    server.name,
                                  );
                                }
                              }}
                              onDelete={() => {
                                setServerToDelete(server);
                                setDeleteDialogOpen(true);
                              }}
                              onError={(e) => openErrorModal(server, e)}
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
                            onClick={() => toggleServerExpand(server.id)}
                            onToggle={async (checked) => {
                              try {
                                if (checked) {
                                  await startServer(server.id);
                                  toast.success(t("serverList.serverStarted"));
                                } else {
                                  await stopServer(server.id);
                                  toast.success(t("serverList.serverStopped"));
                                }
                              } catch (error) {
                                showServerError(
                                  error instanceof Error
                                    ? error
                                    : new Error(String(error)),
                                  server.name,
                                );
                              }
                            }}
                            onDelete={() => {
                              setServerToDelete(server);
                              setDeleteDialogOpen(true);
                            }}
                            onError={(e) => openErrorModal(server, e)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Modals and Sheets */}
      {errorServer && (
        <ServerErrorModal
          isOpen={errorModalOpen}
          onClose={() => setErrorModalOpen(false)}
          serverName={errorServer.name}
          errorMessage={errorServer.errorMessage}
        />
      )}

      <ProjectSettingsModal
        open={isHomeSettingsOpen}
        onOpenChange={setIsHomeSettingsOpen}
        projects={projects}
        onCreateProject={handleCreateProject}
        onRenameProject={handleRenameProject}
        onDeleteProject={handleDeleteProject}
        onUpdateProjectOptimization={handleUpdateProjectOptimization}
      />

      {advancedSettingsServer && (
        <ServerDetailsAdvancedSheet
          server={advancedSettingsServer}
          projects={projects}
          onAssignProject={async (projectId: string | null) => {
            await updateServerConfig(advancedSettingsServer.id, { projectId });
            await refreshServers();
          }}
          onOpenManageProjects={() => setIsHomeSettingsOpen(true)}
          handleSave={async (
            updatedInputParams,
            editedName,
            updatedToolPermissions,
          ) => {
            try {
              const {
                editedCommand,
                editedArgs,
                editedBearerToken,
                editedAutoStart,
                envPairs,
                editedDevEnabled,
                editedWatchPatterns,
              } = useServerEditingStore.getState();
              const envObj: Record<string, string> = {};
              envPairs.forEach((pair) => {
                if (pair.key.trim()) envObj[pair.key.trim()] = pair.value;
              });
              const finalInputParams =
                updatedInputParams || advancedSettingsServer.inputParams;
              if (finalInputParams) {
                Object.entries(finalInputParams).forEach(
                  ([key, param]: [string, any]) => {
                    if (
                      !envObj[key] &&
                      param.default !== undefined &&
                      param.default !== null &&
                      String(param.default).trim() !== ""
                    ) {
                      envObj[key] = String(param.default);
                    }
                  },
                );
              }
              const updatedConfig: any = {
                name: editedName || advancedSettingsServer.name,
                command: editedCommand,
                args: editedArgs,
                env: envObj,
                autoStart: editedAutoStart,
                inputParams: finalInputParams,
              };
              if (advancedSettingsServer.serverType === "local") {
                updatedConfig.dev = {
                  enabled: editedDevEnabled,
                  watch: editedWatchPatterns
                    .split(",")
                    .map((p) => p.trim())
                    .filter(Boolean),
                };
              } else {
                updatedConfig.bearerToken = editedBearerToken;
              }
              await updateServerConfig(
                advancedSettingsServer.id,
                updatedConfig,
              );
              if (updatedToolPermissions)
                await updateServerToolPermissions(
                  advancedSettingsServer.id,
                  updatedToolPermissions,
                );
              setIsAdvancedEditing(false);
              setAdvancedSettingsServer(null);
              toast.success(t("serverDetails.updateSuccess"));
            } catch (_error) {
              toast.error(t("serverDetails.updateFailed"));
            }
          }}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("serverSettings.confirmDeleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("serverSettings.confirmDeleteDescription", {
                serverName: serverToDelete?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteServer}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full"
            >
              {t("serverSettings.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Home;
