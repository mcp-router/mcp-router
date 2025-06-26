import React from "react";
import { MCPServerConfig } from "@mcp-router/shared";
import {
  extractServerVariables,
  ServerVariable,
} from "../../../lib/utils/server-variable-utils";
import { Badge } from "@mcp-router/ui";
import { Database, Server } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@mcp-router/ui";
import { useTranslation } from "react-i18next";

interface ServerVariableDisplayProps {
  servers: MCPServerConfig[];
}

const ServerVariableDisplay: React.FC<ServerVariableDisplayProps> = ({
  servers,
}) => {
  const { t } = useTranslation();

  // Filter to only include servers that have variables
  const serversWithVars = servers.filter(
    (server) => extractServerVariables(server).length > 0,
  );

  if (serversWithVars.length === 0) {
    return null;
  }

  return (
    <div className="border-b mb-4 pb-4">
      <h3 className="font-medium mb-3 flex items-center">
        <Database className="h-4 w-4 mr-2 text-muted-foreground" />
        {t("agents.serverVariables.parameters")}
        <span className="text-sm text-muted-foreground ml-2 font-normal">
          {serversWithVars.length}
          {t("agents.serverVariables.servers")} /{" "}
          {serversWithVars.reduce(
            (count, server) => count + extractServerVariables(server).length,
            0,
          )}
          {t("agents.serverVariables.variables")}
        </span>
      </h3>
      <Accordion type="multiple" className="space-y-2">
        {serversWithVars.map((server) => {
          const variables = extractServerVariables(server);
          return (
            <AccordionItem
              key={server.id}
              value={server.id}
              className="border px-3 py-1 rounded-md bg-muted/30"
            >
              <AccordionTrigger className="py-2 hover:no-underline">
                <div className="flex items-center">
                  <Server className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{server.name}</span>
                  <Badge variant="outline" className="ml-2 text-xs">
                    {variables.length} {t("agents.serverVariables.variables")}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-1 text-sm pt-2 pb-1">
                  {variables.map((variable) => (
                    <div
                      key={variable.name}
                      className="grid grid-cols-[1fr_2fr] gap-2 py-1 border-b border-dashed border-gray-200 dark:border-gray-700 last:border-0"
                    >
                      <div className="font-mono text-blue-600 dark:text-blue-400 flex items-center">
                        {variable.name}
                        {variable.required && (
                          <span className="text-destructive ml-1">*</span>
                        )}
                        <Badge
                          variant="outline"
                          className="ml-2 text-[10px] px-1 py-0 h-4"
                        >
                          {variable.source === "env"
                            ? "ENV"
                            : variable.source === "arg"
                              ? "ARG"
                              : "PARAM"}
                        </Badge>
                      </div>
                      <div className="text-gray-700 dark:text-gray-300 font-mono overflow-hidden text-ellipsis">
                        {variable.value ||
                          `<${t("agents.serverVariables.notSet")}>`}
                        {variable.description && (
                          <div className="text-xs text-muted-foreground mt-1 normal-case">
                            {variable.description}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
};

export default ServerVariableDisplay;
