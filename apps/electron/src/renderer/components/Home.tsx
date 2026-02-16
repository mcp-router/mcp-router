import React from "react";
import { cn } from "@/renderer/utils/tailwind-utils";
import { IconServer, IconSearch } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LoginScreen } from "@/renderer/components/auth/LoginScreen";
import { useServerFiltering } from "./useServerFiltering";
import { ServerToolbar } from "./ServerToolbar";
import { ServerListView } from "./ServerListView";
import { ServerGridView } from "./ServerGridView";
import { ServerModals } from "./ServerModals";

const Home: React.FC = () => {
  const { t } = useTranslation();
  const state = useServerFiltering();

  // Show login screen for remote workspaces if not authenticated
  if (state.currentWorkspace?.type === "remote" && !state.isAuthenticated) {
    return <LoginScreen onLogin={state.login} />;
  }

  return (
    <div className="flex flex-col h-full">
      <ServerToolbar
        searchQuery={state.searchQuery}
        setSearchQuery={state.setSearchQuery}
        serverViewMode={state.serverViewMode}
        setServerViewMode={state.setServerViewMode}
        exportServersToFile={state.exportServersToFile}
        selectedProjectId={state.selectedProjectId}
        setSelectedProjectId={state.setSelectedProjectId}
        projects={state.projects}
        onOpenSettings={() => state.setIsHomeSettingsOpen(true)}
      />

      <div
        className={cn(
          "flex-1 mb-8",
          state.serverViewMode === "list" &&
            "border border-border/50 rounded-2xl overflow-hidden bg-card/30 backdrop-blur-sm shadow-sm",
        )}
      >
        {state.filteredServers.length === 0 && state.searchQuery === "" ? (
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
        ) : state.filteredServers.length === 0 &&
          state.searchQuery !== "" ? (
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
        ) : state.serverViewMode === "list" ? (
          <ServerListView
            filteredServers={state.filteredServers}
            selectedProjectId={state.selectedProjectId}
            projects={state.projects}
            collapsedByProjectId={state.collapsedByProjectId}
            setCollapsed={state.setCollapsed}
            onToggleExpand={state.toggleServerExpand}
            onStartServer={state.startServer}
            onStopServer={state.stopServer}
            onDeleteServer={state.handleDeleteServer}
          />
        ) : (
          <ServerGridView
            filteredServers={state.filteredServers}
            selectedProjectId={state.selectedProjectId}
            projects={state.projects}
            collapsedByProjectId={state.collapsedByProjectId}
            setCollapsed={state.setCollapsed}
            expandedServerId={state.expandedServerId}
            onToggleExpand={state.toggleServerExpand}
            onStartServer={state.startServer}
            onStopServer={state.stopServer}
            onRequestDelete={state.requestDelete}
            onError={state.openErrorModal}
          />
        )}
      </div>

      <ServerModals
        errorServer={state.errorServer}
        errorModalOpen={state.errorModalOpen}
        onCloseErrorModal={() => state.setErrorModalOpen(false)}
        isHomeSettingsOpen={state.isHomeSettingsOpen}
        setIsHomeSettingsOpen={state.setIsHomeSettingsOpen}
        projects={state.projects}
        onCreateProject={state.createProject}
        onRenameProject={state.updateProjectInStore}
        onDeleteProject={state.handleDeleteProject}
        onUpdateProjectOptimization={state.handleUpdateProjectOptimization}
        advancedSettingsServer={state.advancedSettingsServer}
        setAdvancedSettingsServer={state.setAdvancedSettingsServer}
        onUpdateServerConfig={state.updateServerConfig}
        onUpdateServerToolPermissions={state.updateServerToolPermissions}
        onRefreshServers={state.refreshServers}
        deleteDialogOpen={state.deleteDialogOpen}
        setDeleteDialogOpen={state.setDeleteDialogOpen}
        serverToDelete={state.serverToDelete}
        onConfirmDelete={state.confirmDeleteServer}
      />
    </div>
  );
};

export default Home;
