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
  Separator,
} from "@mcp_router/ui";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: MCPServer;
  projects: Project[];
  onAssignProject: (projectId: string | null) => Promise<void> | void;
  onDelete: () => void;
  onOpenManageProjects?: () => void;
};

export const ServerSettingsModal: React.FC<Props> = ({
  open,
  onOpenChange,
  server,
  projects,
  onAssignProject,
  onDelete,
  onOpenManageProjects,
}) => {
  const { t } = useTranslation();
  const [assigning, setAssigning] = useState(false);
  // Project creation is now unified in Settings modal

  React.useEffect(() => {
    if (!open) {
      setAssigning(false);
    }
  }, [open]);

  const currentProjectId = server.projectId ?? null;
  const projectOptions = useMemo(() => {
    return projects.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const handleAssign = async (value: string) => {
    setAssigning(true);
    try {
      await onAssignProject(value === "__none__" ? null : value);
      onOpenChange(false);
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl border-border/40 p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl">
            {t("serverSettings.title", {
              defaultValue: `${server.name} Settings`,
              serverName: server.name,
            })}
          </DialogTitle>
          <DialogDescription></DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section className="space-y-4">
            <div className="text-sm font-bold flex items-center gap-2 px-1">
              {t("serverSettings.project", { defaultValue: "Project" })}
            </div>
            <div className="flex flex-wrap gap-4 items-center">
              <Select
                value={currentProjectId ?? "__none__"}
                onValueChange={handleAssign}
                disabled={assigning}
              >
                <SelectTrigger className="w-64 h-11 rounded-full px-5 bg-muted/20 border-muted/40 focus:bg-muted/30 transition-all">
                  <SelectValue
                    placeholder={t("projects.unassigned", {
                      defaultValue: "Unassigned",
                    })}
                  />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="__none__" className="rounded-lg">
                    {t("projects.unassigned", { defaultValue: "Unassigned" })}
                  </SelectItem>
                  {projectOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="rounded-lg">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={onOpenManageProjects}
                className="rounded-full h-11 px-6"
              >
                {t("serverSettings.manageProjects", {
                  defaultValue: "Manage Projects",
                })}
              </Button>
            </div>
          </section>

          <Separator className="bg-border/40" />

          <section>
            <Button
              variant="destructive"
              onClick={onDelete}
              className="rounded-full h-11 px-6"
            >
              {t("serverSettings.delete", { defaultValue: "Delete Server" })}
            </Button>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ServerSettingsModal;
