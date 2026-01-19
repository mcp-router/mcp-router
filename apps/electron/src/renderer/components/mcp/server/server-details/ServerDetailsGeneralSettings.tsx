import React from "react";
import { MCPServer, Project } from "@mcp_router/shared";
import { useTranslation } from "react-i18next";
import {
  Info,
  FileText,
  Plus,
  Trash,
  Terminal,
  FolderKanban,
} from "lucide-react";
import { Button } from "@mcp_router/ui";
import { Input } from "@mcp_router/ui";
import { Label } from "@mcp_router/ui";
import { Badge } from "@mcp_router/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@mcp_router/ui";
import FinalCommandDisplay from "./FinalCommandDisplay";
import ServerDetailsRemote from "./ServerDetailsRemote";
import ServerDetailsEnvironment from "./ServerDetailsEnvironment";
import ServerDetailsAutoStart from "./ServerDetailsAutoStart";

interface EnvPair {
  key: string;
  value: string;
}

interface ServerDetailsGeneralSettingsProps {
  server: MCPServer;
  // Server Name
  editedName: string;
  setEditedName: (name: string) => void;
  // Command & Args (local server)
  editedCommand: string;
  setEditedCommand: (command: string) => void;
  editedArgs: string[];
  updateArg: (index: number, value: string) => void;
  removeArg: (index: number) => void;
  addArg: () => void;
  // Bearer Token (remote server)
  editedBearerToken: string;
  setEditedBearerToken: (token: string) => void;
  // Auto Start
  editedAutoStart: boolean;
  setEditedAutoStart: (autoStart: boolean) => void;
  // Environment Variables
  envPairs: EnvPair[];
  updateEnvPair: (index: number, field: "key" | "value", value: string) => void;
  removeEnvPair: (index: number) => void;
  addEnvPair: () => void;
  // Input Param Values (for Final Command)
  inputParamValues: Record<string, string>;
  // Project Settings
  projects?: Project[];
  currentProjectId: string | null;
  assigning?: boolean;
  onAssignProject?: (value: string) => void;
  onOpenManageProjects?: () => void;
}

const ServerDetailsGeneralSettings: React.FC<
  ServerDetailsGeneralSettingsProps
> = ({
  server,
  editedName,
  setEditedName,
  editedCommand,
  setEditedCommand,
  editedArgs,
  updateArg,
  removeArg,
  addArg,
  editedBearerToken,
  setEditedBearerToken,
  editedAutoStart,
  setEditedAutoStart,
  envPairs,
  updateEnvPair,
  removeEnvPair,
  addEnvPair,
  inputParamValues,
  projects = [],
  currentProjectId,
  assigning = false,
  onAssignProject,
  onOpenManageProjects,
}) => {
  const { t } = useTranslation();

  const projectOptions = React.useMemo(() => {
    return projects.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  return (
    <div className="space-y-6">
      {/* Project Settings */}
      {onAssignProject && (
        <div className="space-y-3">
          <Label className="text-base font-medium flex items-center gap-1.5">
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
            {t("serverSettings.project", { defaultValue: "Project" })}
          </Label>
          <div className="flex flex-wrap gap-2 items-center">
            <Select
              value={currentProjectId ?? "__none__"}
              onValueChange={onAssignProject}
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
            {onOpenManageProjects && (
              <Button variant="outline" onClick={onOpenManageProjects}>
                {t("serverSettings.manageProjects", {
                  defaultValue: "Manage Projects",
                })}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Server Name */}
      <div className="space-y-3">
        <Label
          htmlFor="server-name"
          className="text-base font-medium flex items-center gap-1.5"
        >
          <Info className="h-4 w-4 text-muted-foreground" />
          {t("serverDetails.serverName")}
        </Label>
        <Input
          id="server-name"
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          placeholder={t("discoverServers.serverNameRequired")}
        />
      </div>

      {/* Edit Forms */}
      {server.serverType === "local" ? (
        <>
          {/* Command */}
          <div className="space-y-3">
            <Label
              htmlFor="server-command"
              className="text-base font-medium flex items-center gap-1.5"
            >
              <Terminal className="h-4 w-4 text-muted-foreground" />
              {t("serverDetails.command")}
            </Label>
            <Input
              id="server-command"
              value={editedCommand}
              onChange={(e) => setEditedCommand(e.target.value)}
              placeholder={t("serverDetails.commandPlaceholder")}
              className="font-mono"
            />
          </div>

          {/* Arguments */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-base font-medium flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-muted-foreground" />
                {t("serverDetails.arguments")}
              </Label>
              <Badge variant="outline" className="font-mono">
                {editedArgs.length} {t("serverDetails.itemsCount")}
              </Badge>
            </div>

            <div className="space-y-2 bg-muted/30 p-3 rounded-md">
              {editedArgs.length === 0 && (
                <div className="text-sm text-muted-foreground italic flex items-center justify-center py-4">
                  <Info className="h-4 w-4 mr-2 text-muted-foreground" />
                  {t("serverDetails.noArguments")}
                </div>
              )}

              {editedArgs.map((arg, index) => (
                <div key={index} className="flex gap-2 group">
                  <Input
                    value={arg}
                    onChange={(e) => updateArg(index, e.target.value)}
                    placeholder={t("serverDetails.argumentPlaceholder")}
                    className="font-mono group-hover:border-primary/50 transition-colors"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => removeArg(index)}
                    type="button"
                    title={t("serverDetails.remove")}
                    className="text-muted-foreground hover:text-destructive hover:border-destructive transition-colors"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={addArg}
              type="button"
              className="mt-2 border-dashed hover:border-primary/70"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("serverDetails.addArgument")}
            </Button>
          </div>
        </>
      ) : (
        <ServerDetailsRemote
          server={server}
          isEditing={true}
          editedBearerToken={editedBearerToken}
          setEditedBearerToken={setEditedBearerToken}
        />
      )}

      {/* Auto Start Configuration (common for both server types) */}
      <ServerDetailsAutoStart
        server={server}
        isEditing={true}
        editedAutoStart={editedAutoStart}
        setEditedAutoStart={setEditedAutoStart}
      />

      {/* Environment Variables (common for both server types) */}
      <ServerDetailsEnvironment
        server={server}
        isEditing={true}
        envPairs={envPairs}
        updateEnvPair={updateEnvPair}
        removeEnvPair={removeEnvPair}
        addEnvPair={addEnvPair}
      />

      {/* Final Command Display */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-primary">
            {t("serverDetails.finalCommand")}
          </h3>
        </div>
        {server.serverType === "local" ? (
          <FinalCommandDisplay
            server={server}
            inputParamValues={inputParamValues}
            editedCommand={editedCommand}
            editedArgs={editedArgs}
          />
        ) : (
          <ServerDetailsRemote server={server} isEditing={false} />
        )}
      </div>
    </div>
  );
};

export default ServerDetailsGeneralSettings;
