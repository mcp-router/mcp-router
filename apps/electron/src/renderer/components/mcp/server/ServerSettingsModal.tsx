import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MCPServer, Project } from "@mcp_router/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
} from "@mcp_router/ui";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: MCPServer;
  projects: Project[];
  onAssignProject: (projectId: string | null) => Promise<void> | void;
  onCreateProject: (input: { name: string }) => Promise<Project>;
  onDelete: () => void;
};

export const ServerSettingsModal: React.FC<Props> = ({
  open,
  onOpenChange,
  server,
  projects,
  onAssignProject,
  onCreateProject,
  onDelete,
}) => {
  const { t } = useTranslation();
  const [assigning, setAssigning] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [isCreateMode, setIsCreateMode] = useState(false);

  React.useEffect(() => {
    if (!open) {
      setIsCreateMode(false);
      setNewProjectName("");
      setAssigning(false);
      setCreating(false);
    }
  }, [open]);

  const currentProjectId = server.projectId ?? null;
  const projectOptions = useMemo(() => {
    return projects.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const handleAssign = async (value: string) => {
    if (value === "__create__") {
      setIsCreateMode(true);
      return;
    }
    setAssigning(true);
    try {
      await onAssignProject(value === "__none__" ? null : value);
    } finally {
      setAssigning(false);
    }
  };

  const handleCreate = async () => {
    const name = newProjectName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const created = await onCreateProject({ name });
      await onAssignProject(created.id);
      setNewProjectName("");
      setIsCreateMode(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("serverSettings.title", { defaultValue: "Server Settings" })}
          </DialogTitle>
          <DialogDescription>{server.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <div className="text-sm font-medium">
              {t("serverSettings.project", { defaultValue: "Project" })}
            </div>
            <div className="flex gap-2 items-center">
              <Select
                value={currentProjectId ?? "__none__"}
                onValueChange={handleAssign}
                disabled={assigning}
              >
                <SelectTrigger className="w-64">
                  <SelectValue
                    placeholder={t("projects.unassigned", {
                      defaultValue: "Unassigned",
                    })}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    {t("projects.unassigned", { defaultValue: "Unassigned" })}
                  </SelectItem>
                  <SelectItem value="__create__">
                    {t("projects.addNew", { defaultValue: "Add new project…" })}
                  </SelectItem>
                  {projectOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isCreateMode && (
              <div className="flex flex-col gap-2">
                <Input
                  className="w-64"
                  placeholder={t("projects.new", {
                    defaultValue: "New project name",
                  })}
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      newProjectName.trim() &&
                      !creating
                    ) {
                      e.preventDefault();
                      handleCreate();
                    }
                    if (e.key === "Escape") {
                      setIsCreateMode(false);
                      setNewProjectName("");
                    }
                  }}
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleCreate}
                    disabled={creating || !newProjectName.trim()}
                  >
                    {creating
                      ? t("projects.creating", { defaultValue: "Creating…" })
                      : t("projects.create", { defaultValue: "Create" })}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsCreateMode(false);
                      setNewProjectName("");
                    }}
                  >
                    {t("common.cancel")}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Button variant="destructive" onClick={onDelete} className="mt-4">
            {t("serverSettings.delete", { defaultValue: "Delete Server" })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ServerSettingsModal;
