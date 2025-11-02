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
    } finally {
      setAssigning(false);
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

        <div className="space-y-6 py-2">
          <section className="space-y-2">
            <div className="text-sm font-medium">
              {t("serverSettings.project", { defaultValue: "Project" })}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
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
                  {projectOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={onOpenManageProjects}>
                {t("serverSettings.manageProjects", {
                  defaultValue: "Manage Projects",
                })}
              </Button>
            </div>
          </section>

          <Separator />

          <section>
            <Button variant="destructive" onClick={onDelete}>
              {t("serverSettings.delete", { defaultValue: "Delete Server" })}
            </Button>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ServerSettingsModal;
