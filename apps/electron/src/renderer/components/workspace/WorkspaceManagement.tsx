import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Avatar,
  AvatarFallback,
  AvatarImage,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@mcp_router/ui";
import { Monitor, Pencil, Trash2, Plus } from "lucide-react";
import { useWorkspaceStore } from "@/renderer/stores/workspace-store";
import { WorkspaceDialog } from "./WorkspaceDialog";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const WorkspaceManagement: React.FC = () => {
  const { t } = useTranslation();
  const _navigate = useNavigate();
  const {
    workspaces,
    currentWorkspace,
    deleteWorkspace,
    switchWorkspace,
    loadWorkspaces,
  } = useWorkspaceStore();

  const [showWorkspaceDialog, setShowWorkspaceDialog] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<any>(null);
  const [deletingWorkspace, setDeletingWorkspace] = useState<any>(null);

  // Sort workspaces by name
  const sortedWorkspaces = React.useMemo(() => {
    return [...workspaces].sort((a, b) => a.name.localeCompare(b.name));
  }, [workspaces]);

  const handleAddWorkspace = () => {
    setEditingWorkspace(null);
    setShowWorkspaceDialog(true);
  };

  const handleEditWorkspace = (workspace: any) => {
    setEditingWorkspace(workspace);
    setShowWorkspaceDialog(true);
  };

  const handleDeleteWorkspace = async () => {
    if (!deletingWorkspace) return;

    try {
      await deleteWorkspace(deletingWorkspace.id);
      toast.success(t("workspace.deleted"));
      setDeletingWorkspace(null);
      // Reload workspaces to refresh the list
      await loadWorkspaces();
    } catch (_error) {
      toast.error(t("workspace.errors.deleteFailed"));
    }
  };

  const handleWorkspaceClick = async (workspaceId: string) => {
    if (currentWorkspace?.id === workspaceId) return;

    try {
      await switchWorkspace(workspaceId);
    } catch (_error) {
      toast.error(t("workspace.errors.switchFailed"));
    }
  };

  const getWorkspaceIcon = () => {
    return Monitor;
  };

  const getWorkspaceInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="p-6 flex flex-col gap-8 max-w-4xl mx-auto">
      {/* Header */}
      <h1 className="text-4xl font-bold tracking-tight px-1">
        {t("workspace.manage")}
      </h1>

      {/* Workspace List */}
      <Card className="border-border/40 shadow-soft rounded-2xl overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between p-8 pb-4">
          <CardTitle className="text-2xl font-bold">
            {t("workspace.title")}
          </CardTitle>
          <Button
            onClick={handleAddWorkspace}
            size="default"
            className="rounded-full px-6 h-11 font-bold shadow-md shadow-primary/10 transition-all hover:scale-105"
          >
            <Plus className="h-5 w-5 mr-2" />
            {t("workspace.addNew")}
          </Button>
        </CardHeader>
        <CardContent className="p-8 pt-4 space-y-4">
          {sortedWorkspaces.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground bg-secondary/10 rounded-2xl border border-dashed border-border/40">
              No workspaces found
            </div>
          ) : (
            sortedWorkspaces.map((workspace) => {
              const Icon = getWorkspaceIcon();
              const isActive = currentWorkspace?.id === workspace.id;

              return (
                <div
                  key={workspace.id}
                  className={`flex items-center justify-between p-6 rounded-2xl border transition-all duration-300 ${
                    isActive
                      ? "border-primary bg-primary/[0.02] shadow-sm ring-1 ring-primary/10"
                      : "border-border/40 hover:border-primary/30 hover:bg-secondary/10 cursor-pointer hover:shadow-md"
                  }`}
                  onClick={() =>
                    !isActive && handleWorkspaceClick(workspace.id)
                  }
                >
                  <div className="flex items-center gap-5">
                    <Avatar className="h-14 w-14 border border-border/40 shadow-sm">
                      {workspace.displayInfo?.avatarUrl ? (
                        <AvatarImage src={workspace.displayInfo.avatarUrl} />
                      ) : (
                        <AvatarFallback className="bg-primary/5 text-primary text-xl font-bold">
                          {getWorkspaceInitials(workspace.name)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-primary/60" />
                        <span className="font-bold text-xl tracking-tight">
                          {workspace.name}
                        </span>
                        {isActive && (
                          <span className="text-[10px] bg-primary text-primary-foreground px-2.5 py-0.5 rounded-full font-bold uppercase tracking-widest shadow-sm">
                            {t("common.active", { defaultValue: "Active" })}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground/60 font-mono">
                        ID: {workspace.id.slice(0, 8)}...
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full h-10 w-10 hover:bg-primary/10 hover:text-primary transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditWorkspace(workspace);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full h-10 w-10 hover:bg-destructive/10 hover:text-destructive transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingWorkspace(workspace);
                      }}
                      disabled={isActive}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Workspace Dialog */}
      {showWorkspaceDialog && (
        <WorkspaceDialog
          workspace={editingWorkspace}
          onClose={() => {
            setShowWorkspaceDialog(false);
            setEditingWorkspace(null);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingWorkspace}
        onOpenChange={() => setDeletingWorkspace(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("workspace.deleteWorkspace")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("workspace.confirmDelete", { name: deletingWorkspace?.name })}
              <br />
              <br />
              {t("workspace.deleteWarning")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWorkspace}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WorkspaceManagement;
