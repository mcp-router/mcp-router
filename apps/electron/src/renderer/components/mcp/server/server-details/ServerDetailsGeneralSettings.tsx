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
import ServerDetailsDevMode from "./ServerDetailsDevMode";

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
  // Dev Mode
  editedDevEnabled: boolean;
  setEditedDevEnabled: (enabled: boolean) => void;
  editedWatchPatterns: string;
  setEditedWatchPatterns: (patterns: string) => void;
}

/**
 * Detect if a server is a local development server (not a package-based server)
 * Returns the detected source directory if it's a local dev server, null otherwise
 */
function detectLocalDevServer(
  command?: string,
  args?: string[],
): { isLocalDev: boolean; sourceDir: string | null } {
  const packageManagers = ["npx", "npm", "yarn", "pnpm", "bunx"];
  const cmd = command?.trim().toLowerCase() || "";

  // Check if command starts with a package manager
  if (packageManagers.some((pm) => cmd === pm || cmd.startsWith(`${pm} `))) {
    return { isLocalDev: false, sourceDir: null };
  }

  // Check if command or args contain absolute paths (local files)
  const allParts = [command || "", ...(args || [])];
  for (const part of allParts) {
    // Match absolute paths (Unix or Windows style)
    const pathMatch = part.match(/^(\/[^/\s]+|[A-Za-z]:\\)/);
    if (pathMatch) {
      // Extract directory from path
      const lastSlash = Math.max(part.lastIndexOf("/"), part.lastIndexOf("\\"));
      if (lastSlash > 0) {
        return { isLocalDev: true, sourceDir: part.substring(0, lastSlash) };
      }
    }
  }

  // Check for relative paths that suggest local development
  if (
    cmd.startsWith("node ") ||
    cmd.startsWith("python ") ||
    cmd.startsWith("python3 ") ||
    cmd.startsWith("ts-node ") ||
    cmd.startsWith("tsx ")
  ) {
    // Look for a file path in args
    for (const arg of args || []) {
      if (
        arg.startsWith("/") ||
        arg.startsWith("./") ||
        arg.startsWith("../")
      ) {
        const lastSlash = arg.lastIndexOf("/");
        if (lastSlash > 0) {
          return { isLocalDev: true, sourceDir: arg.substring(0, lastSlash) };
        }
        return { isLocalDev: true, sourceDir: "." };
      }
    }
  }

  return { isLocalDev: false, sourceDir: null };
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
  editedDevEnabled,
  setEditedDevEnabled,
  editedWatchPatterns,
  setEditedWatchPatterns,
}) => {
  const { t } = useTranslation();

  const projectOptions = React.useMemo(() => {
    return projects.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  // Detect if this is a local development server
  const { isLocalDev, sourceDir } = React.useMemo(
    () => detectLocalDevServer(editedCommand || server.command, editedArgs),
    [editedCommand, server.command, editedArgs],
  );

  return (
    <div className="space-y-6">
      {/* Project Settings */}
      {onAssignProject && (
        <div className="space-y-3">
          <Label className="text-base font-medium flex items-center gap-1.5">
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
            {t("serverSettings.project", { defaultValue: "Project" })}
          </Label>
          <div className="flex flex-wrap gap-3 items-center">
            <Select
              value={currentProjectId ?? "__none__"}
              onValueChange={onAssignProject}
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
            {onOpenManageProjects && (
              <Button
                variant="outline"
                onClick={onOpenManageProjects}
                className="rounded-full h-11 px-6"
              >
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
          className="text-base font-bold flex items-center gap-2 px-1"
        >
          <Info className="h-4 w-4 text-primary" />
          {t("serverDetails.serverName")}
        </Label>
        <Input
          id="server-name"
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          placeholder={t("discoverServers.serverNameRequired")}
          className="h-11 rounded-full px-5 bg-muted/20 border-muted/40 focus:bg-muted/30 transition-all"
        />
      </div>

      {/* Edit Forms */}
      {server.serverType === "local" ? (
        <>
          {/* Command */}
          <div className="space-y-3">
            <Label
              htmlFor="server-command"
              className="text-base font-bold flex items-center gap-2 px-1"
            >
              <Terminal className="h-4 w-4 text-primary" />
              {t("serverDetails.command")}
            </Label>
            <Input
              id="server-command"
              value={editedCommand}
              onChange={(e) => setEditedCommand(e.target.value)}
              placeholder={t("serverDetails.commandPlaceholder")}
              className="h-11 rounded-full px-5 bg-muted/20 border-muted/40 focus:bg-muted/30 transition-all font-mono"
            />
          </div>

          {/* Arguments */}
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <Label className="text-base font-bold flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                {t("serverDetails.arguments")}
              </Label>
              <Badge variant="outline" className="font-mono rounded-full px-3">
                {editedArgs.length} {t("serverDetails.itemsCount")}
              </Badge>
            </div>

            <div className="space-y-4 bg-muted/10 p-6 rounded-2xl border border-muted/40">
              {editedArgs.length === 0 && (
                <div className="text-sm text-muted-foreground italic flex items-center justify-center py-8">
                  <Info className="h-4 w-4 mr-2 text-muted-foreground/50" />
                  {t("serverDetails.noArguments")}
                </div>
              )}

              {editedArgs.map((arg, index) => (
                <div key={index} className="flex gap-2 group">
                  <Input
                    value={arg}
                    onChange={(e) => updateArg(index, e.target.value)}
                    placeholder={t("serverDetails.argumentPlaceholder")}
                    className="h-11 rounded-full px-5 bg-muted/20 border-muted/40 focus:bg-muted/30 transition-all font-mono"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => removeArg(index)}
                    type="button"
                    title={t("serverDetails.remove")}
                    className="h-11 w-11 rounded-full text-muted-foreground hover:text-destructive hover:border-destructive transition-colors shrink-0"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                onClick={addArg}
                type="button"
                className="w-full h-10 rounded-full border-dashed hover:border-primary/70 bg-transparent"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("serverDetails.addArgument")}
              </Button>
            </div>
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

      {/* Developer Options (local development servers only - not package managers) */}
      {server.serverType === "local" && isLocalDev && (
        <ServerDetailsDevMode
          server={server}
          editedDevEnabled={editedDevEnabled}
          setEditedDevEnabled={setEditedDevEnabled}
          editedWatchPatterns={editedWatchPatterns}
          setEditedWatchPatterns={setEditedWatchPatterns}
          detectedSourceDir={sourceDir}
        />
      )}

      {/* Final Command Display */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-2 px-1">
          <Terminal className="h-4 w-4 text-primary" />
          <h3 className="text-base font-bold text-primary">
            {t("serverDetails.finalCommand")}
          </h3>
        </div>
        <div className="rounded-2xl overflow-hidden border border-border/40 soft-shadow">
          {server.serverType === "local" ? (
            <FinalCommandDisplay
              server={server}
              inputParamValues={inputParamValues}
              editedCommand={editedCommand}
              editedArgs={editedArgs}
            />
          ) : (
            <div className="p-4 bg-muted/20">
              <ServerDetailsRemote server={server} isEditing={false} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServerDetailsGeneralSettings;
