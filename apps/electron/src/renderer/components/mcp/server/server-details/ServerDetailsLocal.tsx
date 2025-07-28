import React, { useState, useEffect } from "react";
import { MCPServer } from "@mcp_router/shared";
import { usePlatformAPI } from "@/main/infrastructure/platform-api";
import { useTranslation } from "react-i18next";
import {
  Terminal,
  FileText,
  Info,
  Plus,
  Trash,
  AlertTriangle,
} from "lucide-react";
import { Label } from "@mcp_router/ui";
import { Input } from "@mcp_router/ui";
import { Button } from "@mcp_router/ui";
import { Badge } from "@mcp_router/ui";
import { ScrollArea } from "@mcp_router/ui";

interface ServerDetailsLocalProps {
  server: MCPServer;
  isEditing?: boolean;
  editedCommand?: string;
  editedArgs?: string[];
  inputParamValues?: Record<string, string>;
  setEditedCommand?: (command: string) => void;
  setEditedArgs?: (args: string[]) => void;
  updateArg?: (index: number, value: string) => void;
  removeArg?: (index: number) => void;
  addArg?: () => void;
}

const ServerDetailsLocal: React.FC<ServerDetailsLocalProps> = ({
  server,
  isEditing = false,
  editedCommand = "",
  editedArgs = [],
  inputParamValues = {},
  setEditedCommand,
  setEditedArgs,
  updateArg,
  removeArg,
  addArg,
}) => {
  const { t } = useTranslation();
  const platformAPI = usePlatformAPI();
  const [commandExists, setCommandExists] = useState<boolean | null>(null);
  const [baseCommand, setBaseCommand] = useState<string>("");

  // Check if the command exists when component mounts or command changes
  useEffect(() => {
    if (server.command) {
      // Extract base command (e.g., 'npx' from 'npx -y something')
      const cmd = server.command.split(" ")[0];
      setBaseCommand(cmd);

      // Check if command exists using the API we added
      platformAPI.packages.system
        .checkCommand(cmd)
        .then((exists: boolean) => setCommandExists(exists))
        .catch(() => setCommandExists(false));
    }
  }, [server.command]);

  // Function to substitute parameters in arguments
  const getSubstitutedArgs = (
    args: string[],
    params: Record<string, string> = {},
  ) => {
    return args.map((arg) => {
      // Check if the arg is a parameter reference like "{test}"
      const paramMatch = arg.match(/^\{([^}]+)\}$/);
      if (paramMatch && paramMatch[1]) {
        const paramName = paramMatch[1];
        // Use the input param value, fall back to default value
        const paramValue =
          params[paramName] || server.inputParams?.[paramName]?.default || arg;
        return paramValue;
      }
      return arg;
    });
  };

  // Get the final command string with args
  const getFinalCommandString = () => {
    if (!server.command) return "";

    const command = server.command;
    if (!server.args || server.args.length === 0) return command;

    const substitutedArgs = getSubstitutedArgs(server.args, inputParamValues);
    return `${command} ${substitutedArgs.join(" ")}`;
  };

  if (isEditing) {
    return (
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
            onChange={(e) =>
              setEditedCommand && setEditedCommand(e.target.value)
            }
            placeholder={t("serverDetails.commandPlaceholder")}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-md">
            {t("serverDetails.commandHelp")}
          </p>
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
                  onChange={(e) =>
                    updateArg && updateArg(index, e.target.value)
                  }
                  placeholder={t("serverDetails.argumentPlaceholder")}
                  className="font-mono group-hover:border-primary/50 transition-colors"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => removeArg && removeArg(index)}
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
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-primary">
            {t("serverDetails.finalCommand")}
          </h3>
        </div>
        {commandExists === false && baseCommand && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded flex mb-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mr-2" />
            <div className="text-sm text-yellow-700">
              {baseCommand} {t("serverDetails.commandNotFound")}
            </div>
          </div>
        )}
        <div className="pl-6">
          {server.command ? (
            <div className="bg-muted p-3 rounded-md border shadow-sm">
              <ScrollArea className="max-h-[150px]">
                <div className="whitespace-pre-wrap text-sm font-mono text-primary/90 break-all">
                  {getFinalCommandString()}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground italic p-2">
              <Info className="h-4 w-4" />
              <span>{t("serverDetails.notConfigured")}</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ServerDetailsLocal;
