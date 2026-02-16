import React, { useState, useCallback } from "react";
import { MCPServer, ProjectOptimization } from "@mcp_router/shared";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  useServerStore,
  useServerUIStore,
  useWorkspaceStore,
  useAuthStore,
  useViewPreferencesStore,
  useProjectStore,
  useServerEditingStore,
  UNASSIGNED_PROJECT_ID,
} from "../stores";

export function useServerFiltering() {
  const { t } = useTranslation();

  // Store subscriptions
  const {
    servers,
    startServer,
    stopServer,
    deleteServer,
    refreshServers,
    updateServerConfig,
    updateServerToolPermissions,
  } = useServerStore();
  const { searchQuery, setSearchQuery, expandedServerId } =
    useServerUIStore();
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
  const { initializeFromServer, setIsAdvancedEditing } =
    useServerEditingStore();

  // Filtered servers memo
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

  // Local state
  const [isHomeSettingsOpen, setIsHomeSettingsOpen] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorServer, setErrorServer] = useState<MCPServer | null>(null);
  const [advancedSettingsServer, setAdvancedSettingsServer] =
    useState<MCPServer | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serverToDelete, setServerToDelete] = useState<MCPServer | null>(null);

  // Event handlers
  const toggleServerExpand = useCallback(
    (serverId: string) => {
      const server = servers.find((s) => s.id === serverId);
      if (server) {
        initializeFromServer(server);
        setAdvancedSettingsServer(server);
        setIsAdvancedEditing(true);
      }
    },
    [servers, initializeFromServer, setIsAdvancedEditing],
  );

  const handleDeleteServer = useCallback(
    (server: MCPServer, e: React.MouseEvent) => {
      e.stopPropagation();
      setServerToDelete(server);
      setDeleteDialogOpen(true);
    },
    [],
  );

  const confirmDeleteServer = useCallback(async () => {
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
  }, [serverToDelete, deleteServer, t]);

  const openErrorModal = useCallback(
    (server: MCPServer, e: React.MouseEvent) => {
      e.stopPropagation();
      setErrorServer(server);
      setErrorModalOpen(true);
    },
    [],
  );

  const requestDelete = useCallback((server: MCPServer) => {
    setServerToDelete(server);
    setDeleteDialogOpen(true);
  }, []);

  const exportServersToFile = useCallback(() => {
    const mcpServers: Record<string, unknown> = {};
    servers.forEach((server) => {
      mcpServers[server.name] = {
        command: server.command,
        args: server.args || [],
        env: server.env || {},
      };
    });
    const exportData = { mcpServers };
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri =
      "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
    const exportFileDefaultName = `mcp-servers-${new Date().toISOString().split("T")[0]}.json`;
    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  }, [servers]);

  // Project handlers
  const handleCreateProject = useCallback(
    async (input: { name: string }) => {
      return await createProject(input);
    },
    [createProject],
  );

  const handleRenameProject = useCallback(
    async (id: string, updates: { name: string }) => {
      return await updateProjectInStore(id, updates);
    },
    [updateProjectInStore],
  );

  const handleDeleteProject = useCallback(
    async (id: string) => {
      await deleteProjectInStore(id);
      await refreshServers();
    },
    [deleteProjectInStore, refreshServers],
  );

  const handleUpdateProjectOptimization = useCallback(
    async (id: string, optimization: ProjectOptimization) => {
      return await updateProjectInStore(id, { optimization });
    },
    [updateProjectInStore],
  );

  // Load projects on workspace change
  React.useEffect(() => {
    listProjects().catch((e) => console.error("Failed to load projects", e));
  }, [listProjects, currentWorkspace?.id]);

  return {
    // Data
    servers,
    filteredServers,
    searchQuery,
    setSearchQuery,
    expandedServerId,
    serverViewMode,
    setServerViewMode,
    projects,
    selectedProjectId,
    setSelectedProjectId,
    collapsedByProjectId,
    setCollapsed,
    currentWorkspace,
    isAuthenticated,
    login,

    // Local state
    isHomeSettingsOpen,
    setIsHomeSettingsOpen,
    errorModalOpen,
    setErrorModalOpen,
    errorServer,
    advancedSettingsServer,
    setAdvancedSettingsServer,
    deleteDialogOpen,
    setDeleteDialogOpen,
    serverToDelete,

    // Handlers
    toggleServerExpand,
    handleDeleteServer,
    confirmDeleteServer,
    openErrorModal,
    requestDelete,
    exportServersToFile,
    handleCreateProject,
    handleRenameProject,
    handleDeleteProject,
    handleUpdateProjectOptimization,

    // Store actions
    startServer,
    stopServer,
    refreshServers,
    updateServerConfig,
    updateServerToolPermissions,
  };
}
