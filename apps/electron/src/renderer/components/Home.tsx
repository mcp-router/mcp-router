import React, { useState } from "react";
import { MCPServer } from "@mcp_router/shared";
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
import ProjectSettingsModal from "@/renderer/components/mcp/server/ProjectSettingsModal";

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
    } catch (error) {
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
      const created = await createProject(input);
      await listProjects();
      return created;
    },
    [createProject, listProjects],
  );

  const handleRenameProject = React.useCallback(
    async (id: string, updates: { name: string }) => {
      const updated = await updateProjectInStore(id, updates);
      await listProjects();
      return updated;
    },
    [listProjects, updateProjectInStore],
  );

  const handleDeleteProject = React.useCallback(
    async (id: string) => {
      await deleteProjectInStore(id);
      await listProjects();
      await refreshServers();
    },
    [deleteProjectInStore, listProjects, refreshServers],
  );

  // Show login screen for remote workspaces if not authenticated
  if (currentWorkspace?.type === "remote" && !isAuthenticated) {
    return <LoginScreen onLogin={login} />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsHomeSettingsOpen(true)}
          className="gap-1"
          title={t("projects.projectSettings", {
            defaultValue: "Project Settings",
          })}
        >
          <SettingsIcon className="h-4 w-4" />
        </Button>
        <div className="w-36">
          <Select
            value={selectedProjectId === null ? "__all__" : selectedProjectId}
            onValueChange={(value) =>
              setSelectedProjectId(value === "__all__" ? null : value)
            }
          >
            <SelectTrigger className="h-8">
              <SelectValue
                placeholder={t("projects.all", { defaultValue: "All" })}
              />
            </SelectTrigger>
            <SelectContent>
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
            className="w-full bg-background border border-border rounded-md py-1.5 px-3 pl-8 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <IconSearch className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex gap-1">
          <Button
            variant={serverViewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setServerViewMode("list")}
            className="h-8 w-8 p-0"
            title="List View"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={serverViewMode === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setServerViewMode("grid")}
            className="h-8 w-8 p-0"
            title="Grid View"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={exportServersToFile}
          className="gap-1"
          title="Export"
        >
          <IconUpload className="h-4 w-4" />
        </Button>
        <Button asChild variant="outline" size="sm" className="gap-1">
          <Link to="/servers/add">
            <IconPlus className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div
        className={cn(
          "flex-1 mb-8",
          serverViewMode === "list" && "border rounded-md overflow-hidden",
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
              {/* Unassigned Section (always first unless filtering by project) */}
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
                          "px-4 py-2 flex items-center justify-between bg-muted/20",
                          isUnassignedCollapsible && "cursor-pointer",
                        )}
                        onClick={unassignedHeaderOnClick}
                      >
                        <div className="flex items-center gap-1 text-sm font-semibold">
                          {isUnassignedCollapsible && (
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 transition-transform",
                                collapsed ? "-rotate-90" : "rotate-0",
                              )}
                            />
                          )}
                          {t("projects.unassigned", {
                            defaultValue: "Unassigned",
                          })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {unassignedServers.length}
                        </div>
                      </div>
                      {!effectiveCollapsed &&
                        unassignedServers.map((server) => {
                          // console.log("Server:", server);

                          const status = getStatusVisual(server.status);

                          return (
                            <div key={server.id}>
                              <div
                                className="p-4 hover:bg-sidebar-hover cursor-pointer"
                                onClick={() => toggleServerExpand(server.id)}
                              >
                                <div className="flex justify-between">
                                  <div className="flex flex-col">
                                    <div className="font-medium text-base mb-1 hover:text-primary">
                                      {server.name}
                                    </div>

                                    {/* Description - if available */}
                                    {"description" in server &&
                                      typeof (server as any).description ===
                                        "string" && (
                                        <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                                          {(server as any).description}
                                        </p>
                                      )}
                                    <div className="flex flex-wrap gap-2 mb-1">
                                      {/* Server Type Badge */}
                                      <Badge
                                        variant="secondary"
                                        className="w-fit"
                                      >
                                        {server.serverType === "local"
                                          ? "Local"
                                          : "Remote"}
                                      </Badge>

                                      {/* Status Badge */}
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "w-fit flex items-center gap-1",
                                          status.pulseEffect,
                                        )}
                                      >
                                        <div
                                          className={cn(
                                            "h-2 w-2 rounded-full",
                                            status.color,
                                          )}
                                        ></div>
                                        {t(
                                          `serverList.status.${server.status}`,
                                        )}
                                      </Badge>

                                      {/* Warning Badge for unset required params */}
                                      {hasUnsetRequiredParams(server) && (
                                        <Badge
                                          variant="destructive"
                                          className="w-fit flex items-center gap-1"
                                          title={t(
                                            "serverList.requiredParamsNotSet",
                                          )}
                                        >
                                          <AlertCircle className="h-3 w-3" />
                                          {t("serverList.configRequired")}
                                        </Badge>
                                      )}
                                    </div>

                                    {/* Tags - if available */}
                                    {"tags" in server &&
                                      Array.isArray((server as any).tags) &&
                                      (server as any).tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {(
                                            (server as any).tags as string[]
                                          ).map(
                                            (tag: string, index: number) => (
                                              <Badge
                                                key={index}
                                                variant="outline"
                                                className="text-xs px-1 py-0"
                                              >
                                                {tag}
                                              </Badge>
                                            ),
                                          )}
                                        </div>
                                      )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {server.status === "error" && (
                                      <button
                                        className="text-destructive hover:text-destructive/80 p-1.5 rounded-full hover:bg-destructive/10 transition-colors"
                                        onClick={(e) =>
                                          openErrorModal(server, e)
                                        }
                                        title={t("serverList.errorDetails")}
                                      >
                                        <AlertCircle className="h-4 w-4" />
                                      </button>
                                    )}
                                    <span className="text-xs text-muted-foreground">
                                      {server.status === "running"
                                        ? t("serverList.status.running")
                                        : server.status === "starting"
                                          ? t("serverList.status.starting")
                                          : server.status === "stopping"
                                            ? t("serverList.status.stopping")
                                            : t("serverList.status.stopped")}
                                    </span>
                                    <div className="h-6 w-12">
                                      <Switch
                                        checked={server.status === "running"}
                                        disabled={
                                          server.status === "starting" ||
                                          server.status === "stopping" ||
                                          hasUnsetRequiredParams(server)
                                        }
                                        title={
                                          hasUnsetRequiredParams(server)
                                            ? t(
                                                "serverList.requiredParamsNotSet",
                                              )
                                            : undefined
                                        }
                                        onCheckedChange={async (checked) => {
                                          try {
                                            if (checked) {
                                              await startServer(server.id);
                                              // サーバーが起動完了した場合のメッセージ
                                              toast.success(
                                                t("serverList.serverStarted"),
                                              );
                                            } else {
                                              await stopServer(server.id);
                                              // サーバーが停止完了した場合のメッセージ
                                              toast.success(
                                                t("serverList.serverStopped"),
                                              );
                                            }
                                          } catch (error) {
                                            console.error(
                                              "Server operation failed:",
                                              error,
                                            );
                                            // Use enhanced error display with server name context
                                            showServerError(
                                              error instanceof Error
                                                ? error
                                                : new Error(String(error)),
                                              server.name,
                                            );
                                          }
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    </div>
                                    <button
                                      className="p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                      onClick={(e) =>
                                        handleDeleteServer(server, e)
                                      }
                                      title={t("serverSettings.delete", {
                                        defaultValue: "Delete Server",
                                      })}
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
                        "px-4 py-2 flex items-center justify-between bg-muted/20",
                        isProjectCollapsible && "cursor-pointer",
                      )}
                      onClick={
                        isProjectCollapsible
                          ? () => setCollapsed(project.id, !collapsed)
                          : undefined
                      }
                    >
                      <div className="flex items-center gap-1 text-sm font-semibold">
                        {isProjectCollapsible && (
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 transition-transform",
                              collapsed ? "-rotate-90" : "rotate-0",
                            )}
                          />
                        )}
                        {project.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {sectionServers.length}
                      </div>
                    </div>
                    {!effectiveCollapsed &&
                      sectionServers.map((server) => {
                        const status = getStatusVisual(server.status);
                        return (
                          <div
                            key={server.id}
                            className="p-4 hover:bg-sidebar-hover cursor-pointer"
                            onClick={() => toggleServerExpand(server.id)}
                          >
                            <div className="flex justify-between">
                              <div className="flex flex-col">
                                <div className="font-medium text-base mb-1 hover:text-primary">
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
                                  <Badge variant="secondary" className="w-fit">
                                    {server.serverType === "local"
                                      ? "Local"
                                      : "Remote"}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "w-fit flex items-center gap-1",
                                      status.pulseEffect,
                                    )}
                                  >
                                    <div
                                      className={cn(
                                        "h-2 w-2 rounded-full",
                                        status.color,
                                      )}
                                    ></div>
                                    {t(`serverList.status.${server.status}`)}
                                  </Badge>
                                  {hasUnsetRequiredParams(server) && (
                                    <Badge
                                      variant="destructive"
                                      className="w-fit flex items-center gap-1"
                                      title={t(
                                        "serverList.requiredParamsNotSet",
                                      )}
                                    >
                                      <AlertCircle className="h-3 w-3" />
                                      {t("serverList.configRequired")}
                                    </Badge>
                                  )}
                                </div>
                                {"tags" in server &&
                                  Array.isArray((server as any).tags) &&
                                  (server as any).tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {((server as any).tags as string[]).map(
                                        (tag: string, index: number) => (
                                          <Badge
                                            key={index}
                                            variant="outline"
                                            className="text-xs px-1 py-0"
                                          >
                                            {tag}
                                          </Badge>
                                        ),
                                      )}
                                    </div>
                                  )}
                              </div>
                              <div className="flex items-center gap-2">
                                {server.status === "error" && (
                                  <button
                                    className="text-destructive hover:text-destructive/80 p-1.5 rounded-full hover:bg-destructive/10 transition-colors"
                                    onClick={(e) => openErrorModal(server, e)}
                                    title={t("serverList.errorDetails")}
                                  >
                                    <AlertCircle className="h-4 w-4" />
                                  </button>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {server.status === "running"
                                    ? t("serverList.status.running")
                                    : server.status === "starting"
                                      ? t("serverList.status.starting")
                                      : server.status === "stopping"
                                        ? t("serverList.status.stopping")
                                        : t("serverList.status.stopped")}
                                </span>
                                <div className="h-6 w-12">
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
                                        console.error(
                                          "Server operation failed:",
                                          error,
                                        );
                                        showServerError(
                                          error instanceof Error
                                            ? error
                                            : new Error(String(error)),
                                          server.name,
                                        );
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                                <button
                                  className="p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                  onClick={(e) => handleDeleteServer(server, e)}
                                  title={t("serverSettings.delete", {
                                    defaultValue: "Delete Server",
                                  })}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
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
              {/* Unassigned section for Grid view */}
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
                          "px-2 py-1.5 flex items-center justify-between bg-muted/20 rounded",
                          isUnassignedCollapsible && "cursor-pointer",
                        )}
                        onClick={
                          isUnassignedCollapsible
                            ? () =>
                                setCollapsed(UNASSIGNED_PROJECT_ID, !collapsed)
                            : undefined
                        }
                      >
                        <div className="flex items-center gap-1 text-sm font-semibold">
                          {isUnassignedCollapsible && (
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 transition-transform",
                                collapsed ? "-rotate-90" : "rotate-0",
                              )}
                            />
                          )}
                          {t("projects.unassigned", {
                            defaultValue: "Unassigned",
                          })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {unassignedServers.length}
                        </div>
                      </div>
                      {!effectiveCollapsed && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
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
                                  console.error(
                                    "Server operation failed:",
                                    error,
                                  );
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
                              onError={() => {
                                setErrorServer(server);
                                setErrorModalOpen(true);
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

              {/* Project sections for Grid view */}
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
                        "px-2 py-1.5 flex items-center justify-between bg-muted/20 rounded",
                        isProjectCollapsible && "cursor-pointer",
                      )}
                      onClick={
                        isProjectCollapsible
                          ? () => setCollapsed(project.id, !collapsed)
                          : undefined
                      }
                    >
                      <div className="flex items-center gap-1 text-sm font-semibold">
                        {isProjectCollapsible && (
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 transition-transform",
                              collapsed ? "-rotate-90" : "rotate-0",
                            )}
                          />
                        )}
                        {project.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {sectionServers.length}
                      </div>
                    </div>
                    {!effectiveCollapsed && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
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
                                console.error(
                                  "Server operation failed:",
                                  error,
                                );
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
                            onError={() => {
                              setErrorServer(server);
                              setErrorModalOpen(true);
                            }}
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
      {/* Error Details Modal */}
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
      />

      {/* Advanced Settings Sheet */}
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
            updatedInputParams?: any,
            editedName?: string,
            updatedToolPermissions?: Record<string, boolean>,
          ) => {
            try {
              const {
                editedCommand,
                editedArgs,
                editedBearerToken,
                editedAutoStart,
                envPairs,
              } = useServerEditingStore.getState();

              const envObj: Record<string, string> = {};
              envPairs.forEach((pair) => {
                if (pair.key.trim()) {
                  envObj[pair.key.trim()] = pair.value;
                }
              });

              // inputParamsのdefault値をenvに反映
              const finalInputParams =
                updatedInputParams || advancedSettingsServer.inputParams;
              if (finalInputParams) {
                Object.entries(finalInputParams).forEach(
                  ([key, param]: [string, any]) => {
                    // envに値が設定されていない場合、default値を設定
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

              if (advancedSettingsServer.serverType !== "local") {
                updatedConfig.bearerToken = editedBearerToken;
              }

              await updateServerConfig(
                advancedSettingsServer.id,
                updatedConfig,
              );
              if (updatedToolPermissions) {
                await updateServerToolPermissions(
                  advancedSettingsServer.id,
                  updatedToolPermissions,
                );
              }
              setIsAdvancedEditing(false);
              setAdvancedSettingsServer(null);
              toast.success(t("serverDetails.updateSuccess"));
            } catch (error) {
              console.error("Failed to update server:", error);
              toast.error(t("serverDetails.updateFailed"));
            }
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
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
            <AlertDialogCancel>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteServer}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("serverSettings.delete", { defaultValue: "Delete" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Home;
