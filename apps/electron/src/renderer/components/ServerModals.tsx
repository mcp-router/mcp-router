import React from "react";
import { MCPServer, Project, ProjectOptimization } from "@mcp_router/shared";
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
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ServerErrorModal } from "@/renderer/components/common/ServerErrorModal";
import { ProjectSettingsModal } from "@/renderer/components/mcp/server/ProjectSettingsModal";
import ServerDetailsAdvancedSheet from "@/renderer/components/mcp/server/server-details/ServerDetailsAdvancedSheet";
import { useServerEditingStore } from "../stores";

interface ServerModalsProps {
  // Error modal
  errorServer: MCPServer | null;
  errorModalOpen: boolean;
  onCloseErrorModal: () => void;

  // Project settings
  isHomeSettingsOpen: boolean;
  setIsHomeSettingsOpen: (open: boolean) => void;
  projects: Project[];
  onCreateProject: (input: { name: string }) => Promise<Project>;
  onRenameProject: (id: string, updates: { name: string }) => Promise<Project>;
  onDeleteProject: (id: string) => Promise<void>;
  onUpdateProjectOptimization: (
    id: string,
    optimization: ProjectOptimization,
  ) => Promise<Project>;

  // Advanced settings sheet
  advancedSettingsServer: MCPServer | null;
  setAdvancedSettingsServer: (server: MCPServer | null) => void;
  onUpdateServerConfig: (
    id: string,
    config: any,
  ) => Promise<void>;
  onUpdateServerToolPermissions: (
    id: string,
    permissions: Record<string, boolean>,
  ) => Promise<void>;
  onRefreshServers: () => Promise<void>;

  // Delete dialog
  deleteDialogOpen: boolean;
  setDeleteDialogOpen: (open: boolean) => void;
  serverToDelete: MCPServer | null;
  onConfirmDelete: () => Promise<void>;
}

export const ServerModals: React.FC<ServerModalsProps> = ({
  errorServer,
  errorModalOpen,
  onCloseErrorModal,
  isHomeSettingsOpen,
  setIsHomeSettingsOpen,
  projects,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
  onUpdateProjectOptimization,
  advancedSettingsServer,
  setAdvancedSettingsServer,
  onUpdateServerConfig,
  onUpdateServerToolPermissions,
  onRefreshServers,
  deleteDialogOpen,
  setDeleteDialogOpen,
  serverToDelete,
  onConfirmDelete,
}) => {
  const { t } = useTranslation();
  const { setIsAdvancedEditing } = useServerEditingStore();

  return (
    <>
      {errorServer && (
        <ServerErrorModal
          isOpen={errorModalOpen}
          onClose={onCloseErrorModal}
          serverName={errorServer.name}
          errorMessage={errorServer.errorMessage}
        />
      )}

      <ProjectSettingsModal
        open={isHomeSettingsOpen}
        onOpenChange={setIsHomeSettingsOpen}
        projects={projects}
        onCreateProject={onCreateProject}
        onRenameProject={onRenameProject}
        onDeleteProject={onDeleteProject}
        onUpdateProjectOptimization={onUpdateProjectOptimization}
      />

      {advancedSettingsServer && (
        <ServerDetailsAdvancedSheet
          server={advancedSettingsServer}
          projects={projects}
          onAssignProject={async (projectId: string | null) => {
            await onUpdateServerConfig(advancedSettingsServer.id, {
              projectId,
            });
            await onRefreshServers();
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
              await onUpdateServerConfig(
                advancedSettingsServer.id,
                updatedConfig,
              );
              if (updatedToolPermissions)
                await onUpdateServerToolPermissions(
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
              onClick={onConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full"
            >
              {t("serverSettings.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
