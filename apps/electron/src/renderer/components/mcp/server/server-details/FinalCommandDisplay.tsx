import React from "react";
import { MCPServer, MCPInputParam } from "@mcp_router/shared";
import { useTranslation } from "react-i18next";
import { Terminal, Info } from "lucide-react";
import { ScrollArea } from "@mcp_router/ui";

interface FinalCommandDisplayProps {
  server: MCPServer;
  inputParamValues?: Record<string, string>;
  editedCommand?: string;
  editedArgs?: string[];
}

const FinalCommandDisplay: React.FC<FinalCommandDisplayProps> = ({
  server,
  inputParamValues = {},
  editedCommand,
  editedArgs,
}) => {
  const { t } = useTranslation();

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
    // Use edited values if available, otherwise use server values
    const command =
      editedCommand !== undefined ? editedCommand : server.command;
    const args = editedArgs !== undefined ? editedArgs : server.args;

    if (!command) return "";
    if (!args || args.length === 0) return command;

    const substitutedArgs = getSubstitutedArgs(args, inputParamValues);
    return `${command} ${substitutedArgs.join(" ")}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Terminal className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-primary">
          {t("serverDetails.finalCommand")}
        </h3>
      </div>
      <div className="pl-6">
        {editedCommand || server.command ? (
          <div className="bg-muted p-4 rounded-md border shadow-sm">
            <ScrollArea className="max-h-[200px]">
              <div className="whitespace-pre-wrap text-sm font-mono text-primary break-all">
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
  );
};

export default FinalCommandDisplay;
