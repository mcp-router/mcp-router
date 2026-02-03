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
    <div className="p-10 flex flex-col gap-10 max-w-4xl mx-auto">
      {/* Header */}
      <h1 className="text-4xl font-bold tracking-tight">
        {t("workspace.manage")}
      </h1>

      {/* Workspace List */}
      <Card className="border-border/40 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-6">
          <CardTitle className="text-xl">{t("workspace.title")}</CardTitle>
          <Button
            onClick={handleAddWorkspace}
            size="sm"
            className="rounded-full px-5 h-9 font-semibold"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("workspace.addNew")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {sortedWorkspaces.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-secondary/20 rounded-xl border border-dashed border-border/60">
              No workspaces found
            </div>
          ) : (
            sortedWorkspaces.map((workspace) => {
              const Icon = getWorkspaceIcon();
              const isActive = currentWorkspace?.id === workspace.id;

              return (
                <div
                  key={workspace.id}
                  className={`flex items-center justify-between p-6 rounded-xl border shadow-sm transition-all ${
                    isActive
                      ? "border-primary bg-primary/[0.03] ring-1 ring-primary/20"
                      : "border-border/40 hover:border-border/80 hover:bg-secondary/20 cursor-pointer"
                  }`}
                  onClick={() =>
                    !isActive && handleWorkspaceClick(workspace.id)
                  }
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12 border border-border/40">
                      {workspace.displayInfo?.avatarUrl ? (
                        <AvatarImage src={workspace.displayInfo.avatarUrl} />
                      ) : (
                        <AvatarFallback className="bg-primary/5 text-primary font-bold">
                          {getWorkspaceInitials(workspace.name)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4 text-muted-foreground/70" />
                        <span className="font-semibold text-lg">
                          {workspace.name}
                        </span>
                        {isActive && (
                          <span className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            {t("common.active", { defaultValue: "Active" })}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground/60">
                        Workspace ID: {workspace.id.slice(0, 8)}...
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full h-9 w-9 p-0 hover:bg-primary/10 hover:text-primary transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditWorkspace(workspace);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full h-9 w-9 p-0 hover:bg-destructive/10 hover:text-destructive transition-colors"
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
