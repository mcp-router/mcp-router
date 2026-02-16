import React from "react";
import { Project } from "@mcp_router/shared";
import { Button } from "@mcp_router/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@mcp_router/ui";
import {
  IconSearch,
  IconPlus,
  IconUpload,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Grid3X3, List, Settings as SettingsIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { UNASSIGNED_PROJECT_ID } from "../stores";

interface ServerToolbarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  serverViewMode: string;
  setServerViewMode: (mode: "list" | "grid") => void;
  exportServersToFile: () => void;
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  projects: Project[];
  onOpenSettings: () => void;
}

export const ServerToolbar: React.FC<ServerToolbarProps> = ({
  searchQuery,
  setSearchQuery,
  serverViewMode,
  setServerViewMode,
  exportServersToFile,
  selectedProjectId,
  setSelectedProjectId,
  projects,
  onOpenSettings,
}) => {
  const { t } = useTranslation();

  return (
    <div className="mb-6 flex items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        onClick={onOpenSettings}
        className="gap-1 rounded-full px-4 h-9"
        title={t("projects.projectSettings", {
          defaultValue: "Project Settings",
        })}
      >
        <SettingsIcon className="h-4 w-4" />
      </Button>
      <div className="w-40">
        <Select
          value={selectedProjectId === null ? "__all__" : selectedProjectId}
          onValueChange={(value) =>
            setSelectedProjectId(value === "__all__" ? null : value)
          }
        >
          <SelectTrigger className="h-9 rounded-full px-4">
            <SelectValue
              placeholder={t("projects.all", { defaultValue: "All" })}
            />
          </SelectTrigger>
          <SelectContent className="rounded-2xl">
            <SelectItem value="__all__">
              {t("projects.all", { defaultValue: "All" })}
            </SelectItem>
            <SelectItem value={UNASSIGNED_PROJECT_ID}>
              {t("projects.unassigned", { defaultValue: "Unassigned" })}
            </SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="relative flex-1">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("common.search")}
          className="w-full bg-background border border-border rounded-full py-2 px-4 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
        />
        <IconSearch className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex bg-muted/30 p-1 rounded-full gap-1 border border-border/40">
        <Button
          variant={serverViewMode === "list" ? "default" : "ghost"}
          size="sm"
          onClick={() => setServerViewMode("list")}
          className="h-8 w-8 p-0 rounded-full"
          title="List View"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant={serverViewMode === "grid" ? "default" : "ghost"}
          size="sm"
          onClick={() => setServerViewMode("grid")}
          className="h-8 w-8 p-0 rounded-full"
          title="Grid View"
        >
          <Grid3X3 className="h-4 w-4" />
        </Button>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={exportServersToFile}
        className="gap-1 rounded-full h-9 w-9 p-0"
        title="Export"
      >
        <IconUpload className="h-4 w-4" />
      </Button>
      <Button
        asChild
        variant="default"
        size="sm"
        className="gap-1 rounded-full h-9 px-4"
      >
        <Link to="/servers/add">
          <IconPlus className="h-4 w-4" />
          <span className="font-semibold text-xs">Add Server</span>
        </Link>
      </Button>
    </div>
  );
};
