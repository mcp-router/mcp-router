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
} from "@mcp-router/ui";
import { Monitor, Pencil, Trash2, Plus } from "lucide-react";
import { useWorkspaceStore } from "@/frontend/stores/workspace-store";
import { WorkspaceDialog } from "../WorkspaceDialog";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const WorkspaceManagement: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
    } catch (error) {
      toast.error(t("workspace.errors.deleteFailed"));
    }
  };

  const handleWorkspaceClick = async (workspaceId: string) => {
    if (currentWorkspace?.id === workspaceId) return;

    try {
      await switchWorkspace(workspaceId);
    } catch (error) {
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
    <div className="p-6 flex flex-col gap-6">
      {/* Header */}
      <h1 className="text-3xl font-bold">{t("workspace.manage")}</h1>

      {/* Workspace List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl">{t("workspace.title")}</CardTitle>
          <Button onClick={handleAddWorkspace} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            {t("workspace.addNew")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {sortedWorkspaces.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No workspaces found
            </div>
          ) : (
            sortedWorkspaces.map((workspace) => {
              const Icon = getWorkspaceIcon();
              const isActive = currentWorkspace?.id === workspace.id;

              return (
                <div
                  key={workspace.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    isActive
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent/50 cursor-pointer"
                  } transition-colors`}
                  onClick={() =>
                    !isActive && handleWorkspaceClick(workspace.id)
                  }
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      {workspace.displayInfo?.avatarUrl ? (
                        <AvatarImage src={workspace.displayInfo.avatarUrl} />
                      ) : (
                        <AvatarFallback>
                          {getWorkspaceInitials(workspace.name)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{workspace.name}</span>
                        {isActive && (
                          <span className="text-xs text-primary font-medium">
                            (Active)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
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
