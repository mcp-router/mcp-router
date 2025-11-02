import React from "react";
import { useTranslation } from "react-i18next";
import type { Project } from "@mcp_router/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  ScrollArea,
} from "@mcp_router/ui";
import { Pencil, Share, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { UNASSIGNED_PROJECT_ID } from "@/renderer/stores";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  onCreateProject: (input: { name: string }) => Promise<Project>;
  onRenameProject: (id: string, updates: { name: string }) => Promise<Project>;
  onDeleteProject: (id: string) => Promise<void>;
  onExportServers: () => void;
};

export const MCPSettingsModal: React.FC<Props> = ({
  open,
  onOpenChange,
  projects,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
  onExportServers,
}) => {
  const { t } = useTranslation();
  const [newProjectName, setNewProjectName] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [editingProjectId, setEditingProjectId] = React.useState<string | null>(
    null,
  );
  const [editingName, setEditingName] = React.useState("");
  const [renaming, setRenaming] = React.useState(false);
  const [projectToDelete, setProjectToDelete] = React.useState<Project | null>(
    null,
  );
  const [deletingProjectId, setDeletingProjectId] = React.useState<
    string | null
  >(null);

  React.useEffect(() => {
    if (!open) {
      setNewProjectName("");
      setCreating(false);
      setEditingProjectId(null);
      setEditingName("");
      setRenaming(false);
      setProjectToDelete(null);
      setDeletingProjectId(null);
    }
  }, [open]);

  const managedProjects = React.useMemo(
    () =>
      projects.filter(
        (project) => project.id && project.id !== UNASSIGNED_PROJECT_ID,
      ),
    [projects],
  );

  const resetEditingState = () => {
    setEditingProjectId(null);
    setEditingName("");
    setRenaming(false);
  };

  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await onCreateProject({ name });
      toast.success("Project created.");
      setNewProjectName("");
    } catch (error) {
      console.error("Failed to create project:", error);
      toast.error("Failed to create project.");
    } finally {
      setCreating(false);
    }
  };

  const startEditingProject = (project: Project) => {
    setEditingProjectId(project.id);
    setEditingName(project.name);
  };

  const handleRenameProject = async () => {
    if (!editingProjectId) return;
    const name = editingName.trim();
    if (!name) {
      toast.error("Project name cannot be empty.");
      return;
    }
    setRenaming(true);
    try {
      await onRenameProject(editingProjectId, { name });
      toast.success("Project renamed.");
      resetEditingState();
    } catch (error) {
      console.error("Failed to rename project:", error);
      toast.error("Failed to rename project.");
    } finally {
      setRenaming(false);
    }
  };

  const confirmDeleteProject = (project: Project) => {
    setProjectToDelete(project);
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    setDeletingProjectId(projectToDelete.id);
    try {
      await onDeleteProject(projectToDelete.id);
      toast.success("Project deleted.");
      setProjectToDelete(null);
    } catch (error) {
      console.error("Failed to delete project:", error);
      toast.error("Failed to delete project.");
    } finally {
      setDeletingProjectId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("common.settings")}</DialogTitle>
            <DialogDescription>
              Manage projects and export MCP servers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-2">
            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold">
                  {t("projects.sectionTitle", { defaultValue: "Projects" })}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Add, rename, or remove projects to organize your servers.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  placeholder={t("projects.new", {
                    defaultValue: "New project name",
                  })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !creating) {
                      event.preventDefault();
                      handleCreateProject();
                    }
                  }}
                  className="sm:flex-1"
                />
                <Button
                  onClick={handleCreateProject}
                  disabled={creating || !newProjectName.trim()}
                >
                  {creating
                    ? t("projects.creating", { defaultValue: "Creating…" })
                    : t("projects.create", { defaultValue: "Create" })}
                </Button>
              </div>
              <div className="rounded-md border">
                <ScrollArea className="max-h-64">
                  {managedProjects.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      No projects yet.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {managedProjects.map((project) => {
                        const isEditing = editingProjectId === project.id;
                        const isDeleting = deletingProjectId === project.id;
                        return (
                          <div
                            key={project.id}
                            className="flex items-center gap-3 px-3 py-2"
                          >
                            <div className="flex-1">
                              {isEditing ? (
                                <Input
                                  value={editingName}
                                  onChange={(event) =>
                                    setEditingName(event.target.value)
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" && !renaming) {
                                      event.preventDefault();
                                      handleRenameProject();
                                    }
                                    if (event.key === "Escape") {
                                      event.preventDefault();
                                      resetEditingState();
                                    }
                                  }}
                                  autoFocus
                                />
                              ) : (
                                <span className="text-sm font-medium">
                                  {project.name}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {isEditing ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={handleRenameProject}
                                    disabled={
                                      renaming ||
                                      !editingName.trim() ||
                                      editingName.trim() === project.name
                                    }
                                  >
                                    {renaming
                                      ? t("common.saving", {
                                          defaultValue: "Saving…",
                                        })
                                      : t("common.save")}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={resetEditingState}
                                    disabled={renaming}
                                  >
                                    {t("common.cancel")}
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => startEditingProject(project)}
                                    title="Rename"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                      confirmDeleteProject(project)
                                    }
                                    title={t("common.delete")}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                  {isDeleting && (
                                    <span className="text-xs text-muted-foreground">
                                      Working...
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold">Export</h2>
              </div>
              <Button
                variant="outline"
                className="gap-2"
                onClick={onExportServers}
              >
                <Share className="h-4 w-4" />
                Export MCP servers
              </Button>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!projectToDelete}
        onOpenChange={(open) => {
          if (!open) {
            setProjectToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting this project will unassign any servers that use it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingProjectId}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              disabled={!!deletingProjectId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingProjectId ? "Deleting..." : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MCPSettingsModal;
