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
    <div className="flex flex-col h-full bg-background/30">
      {/* Header */}
      <div className="flex justify-between items-center p-8 bg-background/50 backdrop-blur-sm border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-xl">
            <IconFolderOpen className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-xl font-black tracking-tight">
            {t("skills.agentPaths.title")}
          </h2>
        </div>
        <Button
          onClick={() => setIsNewDialogOpen(true)}
          className="rounded-full px-6 font-bold shadow-sm"
        >
          <IconPlus className="w-4 h-4 mr-2" />
          {t("common.add")}
        </Button>
      </div>

      {/* Agent Path List */}
      <div className="flex-1 overflow-y-auto p-8">
        {agentPaths.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] text-muted-foreground bg-card/30 backdrop-blur-sm rounded-3xl border border-dashed border-border/60">
            <IconFolderOpen className="w-12 h-12 opacity-20 mb-4" />
            <p className="text-lg font-bold tracking-tight">
              {t("skills.agentPaths.empty")}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {agentPaths.map((agentPath) => (
              <div
                key={agentPath.id}
                className="flex items-center justify-between p-6 bg-card/40 rounded-2xl border border-border/40 soft-shadow hover:bg-card/60 transition-all group"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-black text-base tracking-tight mb-1">
                    {agentPath.name}
                  </div>
                  <div className="text-sm text-muted-foreground truncate font-medium bg-muted/30 px-3 py-1 rounded-lg inline-block max-w-full">
                    {agentPath.path}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ml-4"
                  onClick={() => handleDeleteAgentPath(agentPath.id)}
                >
                  <IconTrash className="w-5 h-5" />
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
