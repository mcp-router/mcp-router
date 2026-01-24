import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from "@mcp_router/ui";
import { IconPlus, IconTrash, IconFolderOpen } from "@tabler/icons-react";
import { usePlatformAPI } from "@/renderer/platform-api";
import type { AgentPath } from "@mcp_router/shared";
import { toast } from "sonner";

const AgentPathManager: React.FC = () => {
  const { t } = useTranslation();
  const platformAPI = usePlatformAPI();

  const [agentPaths, setAgentPaths] = useState<AgentPath[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New agent path dialog state
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [newPathName, setNewPathName] = useState("");
  const [newPathValue, setNewPathValue] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);

  const loadAgentPaths = useCallback(async () => {
    try {
      const paths = await platformAPI.skills.agentPaths.list();
      setAgentPaths(paths);
    } catch (error) {
      console.error("Failed to load agent paths:", error);
      toast.error(t("skills.agentPaths.loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [platformAPI, t]);

  useEffect(() => {
    loadAgentPaths();
  }, [loadAgentPaths]);

  const handleSelectFolder = async () => {
    try {
      const folderPath = await platformAPI.skills.agentPaths.selectFolder();
      setNewPathValue(folderPath);
      setDialogError(null);
    } catch (error: any) {
      // Don't show error for cancel
      if (error.message !== "No folder selected") {
        console.error("Failed to select folder:", error);
      }
    }
  };

  const handleCreateAgentPath = async () => {
    if (!newPathName.trim()) {
      setDialogError(t("skills.agentPaths.nameRequired"));
      return;
    }
    if (!newPathValue.trim()) {
      setDialogError(t("skills.agentPaths.pathRequired"));
      return;
    }

    setDialogError(null);
    try {
      await platformAPI.skills.agentPaths.create({
        name: newPathName.trim(),
        path: newPathValue.trim(),
      });
      toast.success(t("skills.agentPaths.createSuccess"));
      setIsNewDialogOpen(false);
      setNewPathName("");
      setNewPathValue("");
      await loadAgentPaths();
    } catch (error: any) {
      setDialogError(error.message || t("skills.agentPaths.createError"));
    }
  };

  const handleCloseNewDialog = () => {
    setIsNewDialogOpen(false);
    setNewPathName("");
    setNewPathValue("");
    setDialogError(null);
  };

  const handleDeleteAgentPath = async (id: string) => {
    try {
      await platformAPI.skills.agentPaths.delete(id);
      toast.success(t("skills.agentPaths.deleteSuccess"));
      await loadAgentPaths();
    } catch (error: any) {
      toast.error(error.message || t("skills.agentPaths.deleteError"));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b">
        <h2 className="text-lg font-semibold">
          {t("skills.agentPaths.title")}
        </h2>
        <Button onClick={() => setIsNewDialogOpen(true)}>
          <IconPlus className="w-4 h-4 mr-2" />
          {t("common.add")}
        </Button>
      </div>

      {/* Agent Path List */}
      <div className="flex-1 overflow-y-auto">
        {agentPaths.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {t("skills.agentPaths.empty")}
          </div>
        ) : (
          <div className="divide-y">
            {agentPaths.map((agentPath) => (
              <div
                key={agentPath.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{agentPath.name}</div>
                  <div className="text-sm text-muted-foreground truncate">
                    {agentPath.path}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive ml-2"
                  onClick={() => handleDeleteAgentPath(agentPath.id)}
                >
                  <IconTrash className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Agent Path Dialog */}
      <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("skills.agentPaths.newDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("skills.agentPaths.newDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="agent-path-name">
                {t("skills.agentPaths.name")}
              </Label>
              <Input
                id="agent-path-name"
                value={newPathName}
                onChange={(e) => {
                  setNewPathName(e.target.value);
                  setDialogError(null);
                }}
                placeholder={t("skills.agentPaths.namePlaceholder")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="agent-path-value">
                {t("skills.agentPaths.path")}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="agent-path-value"
                  value={newPathValue}
                  onChange={(e) => {
                    setNewPathValue(e.target.value);
                    setDialogError(null);
                  }}
                  placeholder={t("skills.agentPaths.pathPlaceholder")}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSelectFolder}
                >
                  <IconFolderOpen className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("skills.agentPaths.pathHint")}
              </p>
            </div>
            {dialogError && (
              <p className="text-xs text-destructive">{dialogError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseNewDialog}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleCreateAgentPath}>
              {t("skills.agentPaths.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgentPathManager;
