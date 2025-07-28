import React, { useState, useEffect } from "react";
import { AgentConfig, MCPServerConfig } from "@mcp_router/shared";
import { Button } from "@mcp_router/ui";
import { Input } from "@mcp_router/ui";
import { Label } from "@mcp_router/ui";
import { Textarea } from "@mcp_router/ui";
import { Badge } from "@mcp_router/ui";
import { Switch } from "@mcp_router/ui";
import { toast } from "sonner";
import { Server, X, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ScrollArea } from "@mcp_router/ui";

interface ServerConfigVariable {
  name: string;
  value: string;
  description?: string;
  required?: boolean;
}

interface ServerSettingsFormProps {
  agent: AgentConfig;
  setAgent: (update: Partial<AgentConfig>) => void;
  selectedServers: MCPServerConfig[];
  setSelectedServers: (servers: MCPServerConfig[]) => void;
  onSave?: () => void;
  onBack?: () => void;
}

const ServerSettingsForm: React.FC<ServerSettingsFormProps> = ({
  agent,
  setAgent,
  selectedServers,
  setSelectedServers,
  onSave,
  onBack,
}) => {
  const { t } = useTranslation();
  const [serverVariables, setServerVariables] = useState<
    Record<string, ServerConfigVariable[]>
  >({});
  const [serverInstructions, setServerInstructions] = useState<
    Record<string, string>
  >({});
  const [isSaving, setIsSaving] = useState(false);

  // Extract server variables and instructions from servers on component mount
  useEffect(() => {
    const variables: Record<string, ServerConfigVariable[]> = {};
    const instructions: Record<string, string> = {};

    selectedServers.forEach((server) => {
      // Extract variables from environment variables
      const envVars: ServerConfigVariable[] = Object.entries(
        server.env || {},
      ).map(([name, value]) => ({
        name,
        value: value || "",
        required: server.required?.includes(name),
      }));

      // Extract variables from args with pattern {variableName}
      const argVars: ServerConfigVariable[] = [];
      server.args?.forEach((arg) => {
        const match = arg.match(/^\{([^}]+)\}$/);
        if (match) {
          const varName = match[1];
          // Check if it's not already in envVars
          if (!envVars.some((v) => v.name === varName)) {
            // Get value from inputParams if exists
            const inputParam = server.inputParams?.[varName];
            argVars.push({
              name: varName,
              value: inputParam?.default || "",
              description: inputParam?.description,
              required: server.required?.includes(varName),
            });
          }
        }
      });

      variables[server.id] = [...envVars, ...argVars];
      instructions[server.id] = server.setupInstructions || "";
    });

    setServerVariables(variables);
    setServerInstructions(instructions);
  }, [selectedServers]);

  // Handle variable value change
  const handleVariableChange = (
    serverId: string,
    varName: string,
    value: string,
  ) => {
    setServerVariables((prev) => {
      const serverVars = [...(prev[serverId] || [])];
      const varIndex = serverVars.findIndex((v) => v.name === varName);

      if (varIndex !== -1) {
        serverVars[varIndex] = { ...serverVars[varIndex], value };
      }

      return {
        ...prev,
        [serverId]: serverVars,
      };
    });
  };

  // Save all settings
  const handleSaveSettings = async () => {
    setIsSaving(true);

    try {
      // Update server configurations with new values
      const updatedServers = selectedServers.map((server) => {
        const serverVars = serverVariables[server.id] ?? [];
        const updatedEnv = server.env ? { ...server.env } : {};
        const updatedInputParams = server.inputParams
          ? { ...server.inputParams }
          : {};

        // Separate env variables and input params
        serverVars.forEach((variable) => {
          // Check if this variable is from args (input param)
          const isFromArgs = server.args?.some(
            (arg) => arg === `{${variable.name}}`,
          );

          if (isFromArgs) {
            // Update inputParams for arg placeholders
            updatedInputParams[variable.name] = {
              default: variable.value,
              description: variable.description || "",
            };
          } else {
            // Update env for actual environment variables
            updatedEnv[variable.name] = variable.value;
          }
        });

        return {
          ...server,
          env: updatedEnv,
          inputParams: updatedInputParams,
          setupInstructions:
            serverInstructions[server.id] || server.setupInstructions,
        };
      });

      // Send updated servers to parent
      setSelectedServers(updatedServers);

      // Update agent config if needed
      if (agent) {
        setAgent({
          mcpServers: updatedServers,
          // Keep the existing instructions if any
          ...(agent.instructions && { instructions: agent.instructions }),
        });
      }

      // Callback to parent if provided
      if (onSave) {
        onSave();
      }
    } catch (error) {
      console.error("Failed to save server settings:", error);
      toast.error(t("agents.serverSettingsError"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="pb-4 mb-4 border-b">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-medium">{t("agents.serverSetup")}</h2>
          <div className="flex gap-4 items-center">
            <Button onClick={handleSaveSettings} disabled={isSaving} size="sm">
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 h-[calc(100%-4rem)] overflow-auto">
        <div className="space-y-6">
          {/* Auto Execute Tool Setting */}
          <div className="border-b pb-6">
            <div className="flex items-center space-x-2">
              <Switch
                id="auto-execute-tool"
                checked={agent.autoExecuteTool}
                onCheckedChange={(checked) =>
                  setAgent({ autoExecuteTool: checked })
                }
              />
              <Label htmlFor="auto-execute-tool">
                {t("agents.autoExecuteTool")}
              </Label>
            </div>
          </div>

          {/* Server Configuration Sections */}
          {selectedServers.length > 0 &&
            selectedServers.filter(
              (server) => (serverVariables[server.id]?.length || 0) > 0,
            ).length !== 0 && (
              <div className="space-y-8">
                {selectedServers
                  .filter(
                    (server) => (serverVariables[server.id]?.length || 0) > 0,
                  )
                  .map((server) => (
                    <div key={server.id} className="border-b pb-6">
                      <div className="flex items-center mb-4">
                        <Server className="mr-2 h-5 w-5 text-muted-foreground" />
                        <h3 className="text-base font-medium">{server.name}</h3>
                      </div>
                      <div className="pl-1">
                        {serverInstructions[server.id] && (
                          <div className="p-3 bg-muted/50 rounded-md mb-5 whitespace-pre-line text-sm text-muted-foreground">
                            {serverInstructions[server.id]}
                          </div>
                        )}
                        <div className="space-y-5">
                          {serverVariables[server.id]?.map(
                            (variable, index) => (
                              <div
                                key={`${server.id}-${variable.name}`}
                                className="flex flex-col gap-2"
                              >
                                <Label
                                  htmlFor={`var-${server.id}-${variable.name}`}
                                >
                                  {variable.name}
                                  {variable.required && (
                                    <span className="text-destructive ml-1">
                                      *
                                    </span>
                                  )}
                                </Label>
                                <Input
                                  id={`var-${server.id}-${variable.name}`}
                                  value={variable.value}
                                  onChange={(e) =>
                                    handleVariableChange(
                                      server.id,
                                      variable.name,
                                      e.target.value,
                                    )
                                  }
                                />
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ServerSettingsForm;
