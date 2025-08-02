import React, { useMemo } from "react";
import { MCPServer } from "@mcp_router/shared";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import { ScrollArea } from "@mcp_router/ui";

interface FinalCommandDisplayProps {
  server: MCPServer;
  inputParamValues?: Record<string, string>;
  editedCommand?: string;
  editedArgs?: string[];
}

const FinalCommandDisplay: React.FC<FinalCommandDisplayProps> = React.memo(
  ({ server, inputParamValues = {}, editedCommand, editedArgs }) => {
    const { t } = useTranslation();

    // Memoize the final command string calculation
    const finalCommandString = useMemo(() => {
      // Use edited values if available, otherwise use server values
      const command =
        editedCommand !== undefined ? editedCommand : server.command;
      const args = editedArgs !== undefined ? editedArgs : server.args;

      if (!command) return "";
      if (!args || args.length === 0) return command;

      // Substitute parameters in arguments
      const substitutedArgs = args.map((arg) => {
        // Check if the arg is a parameter reference like "{test}"
        const paramMatch = arg.match(/^\{([^}]+)\}$/);
        if (paramMatch && paramMatch[1]) {
          const paramName = paramMatch[1];
          // Use the input param value, fall back to default value
          const paramValue =
            inputParamValues[paramName] ||
            server.inputParams?.[paramName]?.default ||
            arg;
          return paramValue;
        }
        return arg;
      });

      return `${command} ${substitutedArgs.join(" ")}`;
    }, [
      editedCommand,
      editedArgs,
      server.command,
      server.args,
      server.inputParams,
      inputParamValues,
    ]);

    return (
      <div>
        {editedCommand || server.command ? (
          <div className="bg-muted p-4 rounded-md border shadow-sm">
            <ScrollArea className="max-h-[200px]">
              <div className="whitespace-pre-wrap text-sm font-mono text-primary break-all">
                {finalCommandString}
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
    );
  },
  // Custom comparison function to prevent unnecessary re-renders
  (prevProps, nextProps) => {
    // Check if server reference changed
    if (prevProps.server !== nextProps.server) {
      // Deep check for relevant server properties
      if (
        prevProps.server.command !== nextProps.server.command ||
        prevProps.server.args !== nextProps.server.args ||
        prevProps.server.inputParams !== nextProps.server.inputParams
      ) {
        return false;
      }
    }

    // Check edited values
    if (prevProps.editedCommand !== nextProps.editedCommand) return false;
    if (prevProps.editedArgs !== nextProps.editedArgs) return false;

    // Deep compare inputParamValues
    const prevKeys = Object.keys(prevProps.inputParamValues || {});
    const nextKeys = Object.keys(nextProps.inputParamValues || {});
    if (prevKeys.length !== nextKeys.length) return false;

    for (const key of prevKeys) {
      if (
        prevProps.inputParamValues?.[key] !== nextProps.inputParamValues?.[key]
      ) {
        return false;
      }
    }

    return true;
  },
);

FinalCommandDisplay.displayName = "FinalCommandDisplay";

export default FinalCommandDisplay;
