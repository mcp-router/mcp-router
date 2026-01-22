import React from "react";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_SEARCH_STRATEGY,
  type Project,
  type ProjectOptimization,
  type ToolCatalogSearchStrategy,
} from "@mcp_router/shared";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@mcp_router/ui";
import { Pencil, Trash2, Info } from "lucide-react";
import { toast } from "sonner";
import { UNASSIGNED_PROJECT_ID } from "@/renderer/stores";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  onCreateProject: (input: { name: string }) => Promise<Project>;
  onRenameProject: (id: string, updates: { name: string }) => Promise<Project>;
  onDeleteProject: (id: string) => Promise<void>;
  onUpdateProjectOptimization: (
    id: string,
    optimization: ProjectOptimization,
  ) => Promise<Project>;
};

export const ProjectSettingsModal: React.FC<Props> = ({
  open,
  onOpenChange,
  projects,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
  onUpdateProjectOptimization,
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
    } catch (error: any) {
      console.error("Failed to create project:", error);
      const message = error?.message ?? "Failed to create project.";
      toast.error(message);
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
    } catch (error: any) {
      console.error("Failed to rename project:", error);
      const message = error?.message ?? "Failed to rename project.";
      toast.error(message);
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

  const handleUpdateOptimization = (
    project: Project,
    optimization: ProjectOptimization,
  ) => {
    onUpdateProjectOptimization(project.id, optimization).catch(
      (error: any) => {
        console.error("Failed to save project optimization:", error);
        const message = error?.message ?? "Failed to save settings.";
        toast.error(message);
      },
    );
  };

  const handleToggleContextOptimization = (
    project: Project,
    enabled: boolean,
  ) => {
    // When enabling, use default strategy. When disabling, set to null.
    const optimization = enabled ? DEFAULT_SEARCH_STRATEGY : null;
    handleUpdateOptimization(project, optimization);
  };

  const handleChangeSearchStrategy = (
    project: Project,
    strategy: ToolCatalogSearchStrategy,
  ) => {
    handleUpdateOptimization(project, strategy);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t("projects.projectSettings", {
                defaultValue: "Project Settings",
              })}
            </DialogTitle>
            <DialogDescription>
              {t("projects.projectSettingsDescription", {
                defaultValue:
                  "Projects separate MCP server usage contexts within MCP Router.",
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="h-3 w-3 mt-0.5" />
            <span>
              {t("projects.projectSettingsCliHint", {
                defaultValue:
                  "To use servers assigned to a project from the CLI, run `npx -y @mcp_router/cli connect --project <project-name>`.",
              })}
            </span>
          </div>
          <div className="space-y-6 py-2">
            <section className="space-y-3">
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
                  disabled={creating || newProjectName.trim().length === 0}
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
                        // optimization = null means disabled, otherwise enabled with strategy
                        const contextOptEnabled = project.optimization !== null;
                        const searchStrategy =
                          project.optimization ?? DEFAULT_SEARCH_STRATEGY;

                        return (
                          <div
                            key={project.id}
                            className="flex items-center gap-3 px-3 py-2"
                          >
                            {/* Project name */}
                            <div className="flex-1 min-w-0">
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
                                <span className="text-sm font-medium truncate block">
                                  {project.name}
                                </span>
                              )}
                            </div>

                            {/* Context Optimization settings (inline) */}
                            {!isEditing && (
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs text-muted-foreground">
                                  {t("projects.contextOptimization", {
                                    defaultValue: "Context Optimization",
                                  })}
                                </span>
                                <Switch
                                  checked={contextOptEnabled}
                                  onCheckedChange={(checked) =>
                                    handleToggleContextOptimization(
                                      project,
                                      checked,
                                    )
                                  }
                                />
                                {contextOptEnabled && (
                                  <Select
                                    value={searchStrategy}
                                    onValueChange={(value) =>
                                      handleChangeSearchStrategy(
                                        project,
                                        value as ToolCatalogSearchStrategy,
                                      )
                                    }
                                  >
                                    <SelectTrigger className="h-7 w-24">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="bm25">
                                        {t("projects.searchStrategyBm25", {
                                          defaultValue: "BM25",
                                        })}
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex items-center gap-1 shrink-0">
                              {isEditing ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={handleRenameProject}
                                    disabled={
                                      renaming ||
                                      editingName.trim().length === 0 ||
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
              Deleting this project will delete all servers associated with it.
              This action cannot be undone. Are you sure you want to proceed?
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

export default ProjectSettingsModal;
