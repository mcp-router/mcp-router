import React, { useState, useEffect, useCallback, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { Input } from "@mcp_router/ui";
import { Textarea } from "@mcp_router/ui";
import { Server, Save, Power } from "lucide-react";
import { Label } from "@mcp_router/ui";
import { ScrollArea } from "@mcp_router/ui";
import { Switch } from "@mcp_router/ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@mcp_router/ui";
import { Button } from "@mcp_router/ui";
import {
  DeployedAgent,
  MCPServerConfig,
  AgentConfig,
} from "@mcp_router/shared";
import { useTranslation } from "react-i18next";
import { isAgentConfigured } from "@/main/domain/agent/shared/agent-utils";
import { McpSettings } from "@/renderer/components/agent/create/McpSettings";
import { useAgentStore } from "../../../stores";
import { cn } from "@/renderer/utils/tailwind-utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@mcp_router/ui";
import { toast } from "sonner";
import { usePlatformAPI } from "@/renderer/platform-api";

interface ServerConfigVariable {
  name: string;
  value: string;
  description?: string;
  required?: boolean;
  type?: "env" | "arg"; // 変数の種類を識別
}

// AgentConfigの型から'id'を除いた型を定義
type AgentConfigWithoutId = Omit<AgentConfig, "id">;

/**
 * Agent Settings Component
 * Manages agent settings (basic server configuration and advanced agent properties)
 */
const AgentSettings: React.FC = () => {
  const { t } = useTranslation();
  const { agent } = useOutletContext<{ agent: DeployedAgent }>();
  const platformAPI = usePlatformAPI();
  // Zustand store
  const { updateDeployedAgent } = useAgentStore();

  // Track if there are unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const lastSavedStateRef = useRef<string>("");

  // 現在のエージェントの状態（編集中の値）
  const [currentAgent, setCurrentAgent] = useState<AgentConfig>({
    id: agent.id,
    name: agent.name || "",
    purpose: agent.purpose || "",
    description: agent.description || "",
    instructions: agent.instructions || "",
    mcpServers: agent.mcpServers || [],
    toolPermissions: agent.toolPermissions || {},
    autoExecuteTool: agent.autoExecuteTool ?? true,
    mcpServerEnabled: agent.mcpServerEnabled ?? false,
    createdAt: agent.createdAt || Date.now(),
    updatedAt: agent.updatedAt || Date.now(),
  });

  // AgentSettingsFormに渡すためのsetAgent関数を作成
  const setAgentWithoutId = useCallback(
    (value: React.SetStateAction<AgentConfigWithoutId>) => {
      setCurrentAgent((current) => {
        const id = current.id;

        if (typeof value === "function") {
          // current から id を除いたオブジェクトを作成
          const { id: _id, ...rest } = current;
          // 関数を適用して新しい状態を取得
          const newStateWithoutId = value(rest);
          // id を復元して返す
          const newState = { ...newStateWithoutId, id };

          // Check if MCP servers changed and update related state
          if (
            JSON.stringify(newState.mcpServers) !==
            JSON.stringify(current.mcpServers)
          ) {
            // Re-extract server data when servers change
            const { variables, instructions } = extractServerData(
              newState.mcpServers,
            );

            setAgentState((prev) => ({
              ...prev,
              serverVariables: variables,
              serverInstructions: instructions,
            }));
          }

          return newState;
        } else {
          // オブジェクトの場合は直接マージして id を保持
          const newState = { ...value, id };

          // Check if MCP servers changed and update related state
          if (
            JSON.stringify(newState.mcpServers) !==
            JSON.stringify(current.mcpServers)
          ) {
            // Re-extract server data when servers change
            const { variables, instructions } = extractServerData(
              newState.mcpServers,
            );

            setAgentState((prev) => ({
              ...prev,
              serverVariables: variables,
              serverInstructions: instructions,
            }));
          }

          return newState;
        }
      });
    },
    [],
  ); // extractServerData関数をdependencyから削除し、関数内で定義し直す

  // Helper function to extract server data (moved inside component to avoid dependency issues)
  const extractServerData = useCallback((servers: MCPServerConfig[]) => {
    const variables: Record<string, ServerConfigVariable[]> = {};
    const instructions: Record<string, string> = {};

    servers.forEach((server) => {
      // Extract env variables (these are from environment configuration)
      const envVars = Object.entries(server.env || {}).map(([name, value]) => ({
        name,
        value: value || "",
        required: server.required?.includes(name),
        type: "env" as const,
      }));

      // Extract arg variables (these are placeholders in args array)
      const argVars =
        server.args?.reduce(
          (acc, arg) => {
            const match = arg.match(/^\{([^}]+)\}$/);
            if (match && !envVars.some((v) => v.name === match[1])) {
              acc.push({
                name: match[1],
                value: "",
                required: server.required?.includes(match[1]),
                type: "arg" as const,
              });
            }
            return acc;
          },
          [] as Array<ServerConfigVariable & { type: "arg" }>,
        ) || [];

      variables[server.id] = [...envVars, ...argVars];
      instructions[server.id] = server.setupInstructions || "";
    });

    return { variables, instructions };
  }, []);

  // All agent state in a single object for server variables tracking
  const [agentState, setAgentState] = useState({
    configurationComplete: false,
    serverVariables: {} as Record<string, ServerConfigVariable[]>,
    serverInstructions: {} as Record<string, string>,
  });

  // Initialize state from agent data
  useEffect(() => {
    if (!agent?.mcpServers) return;

    const { variables, instructions } = extractServerData(agent.mcpServers);

    // Update current agent state to match the latest agent data
    setCurrentAgent({
      id: agent.id,
      name: agent.name || "",
      purpose: agent.purpose || "",
      description: agent.description || "",
      instructions: agent.instructions || "",
      mcpServers: agent.mcpServers || [],
      toolPermissions: agent.toolPermissions || {},
      autoExecuteTool: agent.autoExecuteTool ?? true,
      mcpServerEnabled: agent.mcpServerEnabled ?? false,
      createdAt: agent.createdAt || Date.now(),
      updatedAt: agent.updatedAt || Date.now(),
    });

    setAgentState({
      configurationComplete: isAgentConfigured(agent),
      serverVariables: variables,
      serverInstructions: instructions,
    });
  }, [agent, extractServerData]);

  // Update state helper
  const updateAgentState = (updates: Partial<typeof agentState>) => {
    setAgentState((prev) => ({ ...prev, ...updates }));
  };

  // Handle variable value change
  const handleVariableChange = (
    serverId: string,
    varName: string,
    value: string,
  ) => {
    // Update server variables in agentState
    updateAgentState({
      serverVariables: {
        ...agentState.serverVariables,
        [serverId]:
          agentState.serverVariables[serverId]?.map((v) =>
            v.name === varName ? { ...v, value } : v,
          ) || [],
      },
    });

    // Also update the currentAgent's mcpServers to ensure changes are saved
    setCurrentAgent((prev) => {
      const updatedServers = prev.mcpServers.map((server) => {
        if (server.id === serverId) {
          const updatedEnv = { ...server.env };

          // Update the environment variable value
          const serverVars = agentState.serverVariables[serverId] || [];
          const variable = serverVars.find((v) => v.name === varName);

          if (variable && (variable.type === "env" || !variable.type)) {
            updatedEnv[varName] = value;
          }

          return {
            ...server,
            env: updatedEnv,
          };
        }
        return server;
      });

      return {
        ...prev,
        mcpServers: updatedServers,
      };
    });
  };

  // Manual save function
  const manualSave = useCallback(async () => {
    if (!agent || isSaving) return;

    setIsSaving(true);
    try {
      // Update MCP servers with new values
      const updatedServers = currentAgent.mcpServers.map(
        (server: MCPServerConfig) => {
          const serverVars = agentState.serverVariables[server.id] || [];

          // Start with existing env values
          const updatedEnv: Record<string, string> = { ...server.env };

          serverVars
            .filter((variable) => variable.type === "env" || !variable.type)
            .forEach((variable) => {
              // Update or add the variable value
              updatedEnv[variable.name] = variable.value || "";
            });

          return {
            ...server,
            env: updatedEnv,
            setupInstructions:
              agentState.serverInstructions[server.id] ||
              server.setupInstructions,
          };
        },
      );

      const updatedAgent = {
        ...currentAgent,
        mcpServers: updatedServers,
      };

      await platformAPI.agents.updateDeployed(agent.id, updatedAgent);

      // Update the Zustand store to reflect changes
      updateDeployedAgent(agent.id, updatedAgent);

      // Update current agent state with the saved values
      setCurrentAgent(updatedAgent);
      updateAgentState({
        configurationComplete: isAgentConfigured(updatedAgent),
      });

      // Update saved state and clear unsaved changes flag
      lastSavedStateRef.current = JSON.stringify({
        agent: updatedAgent,
        serverVariables: agentState.serverVariables,
        serverInstructions: agentState.serverInstructions,
      });
      setHasUnsavedChanges(false);

      // Show success toast
      toast.success(t("agents.settingsSaved"));
    } catch (error) {
      console.error("Manual save failed:", error);
    } finally {
      setIsSaving(false);
    }
  }, [agent, currentAgent, agentState, updateDeployedAgent, isSaving]);

  // Check for unsaved changes
  useEffect(() => {
    const currentState = JSON.stringify({
      agent: currentAgent,
      serverVariables: agentState.serverVariables,
      serverInstructions: agentState.serverInstructions,
    });

    if (
      lastSavedStateRef.current &&
      currentState !== lastSavedStateRef.current
    ) {
      setHasUnsavedChanges(true);
    } else {
      setHasUnsavedChanges(false);
    }
  }, [currentAgent, agentState]);

  // Initialize saved state on mount
  useEffect(() => {
    if (agent) {
      lastSavedStateRef.current = JSON.stringify({
        agent: currentAgent,
        serverVariables: agentState.serverVariables,
        serverInstructions: agentState.serverInstructions,
      });
      setHasUnsavedChanges(false);
    }
  }, [agent]); // Only run when agent changes (initial load)

  return (
    <div className="flex flex-col h-full">
      <div className="pb-4 mb-4 border-b">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-medium">{t("agents.settings")}</h2>
            {/* Configuration status */}
            <div className="flex items-center">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  agentState.configurationComplete
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                }`}
              >
                {agentState.configurationComplete
                  ? t("agents.status.configured")
                  : t("agents.status.unconfigured")}
              </span>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {/* Save button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  onClick={manualSave}
                  disabled={!hasUnsavedChanges || isSaving}
                  className="h-8 w-8 p-0"
                >
                  {isSaving ? (
                    <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {isSaving
                    ? t("common.saving", "Saving...")
                    : hasUnsavedChanges
                      ? t("common.save")
                      : t("common.noChanges", "No changes")}
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      <Tabs defaultValue="basic" className="flex-1 h-[calc(100%-4rem)]">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="basic">{t("agents.tabs.basic")}</TabsTrigger>
          <TabsTrigger value="advanced">
            {t("agents.tabs.advanced")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-4 h-[calc(100%-3rem)]">
          <ScrollArea className="h-full overflow-auto">
            {agent?.mcpServers && agent.mcpServers.length > 0 ? (
              <div className="space-y-8">
                <div className="group relative flex items-center justify-between p-4 mb-6 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                        currentAgent.mcpServerEnabled
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Power className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="mcp-server-enabled"
                        className="text-sm font-medium cursor-pointer"
                      >
                        {t("agents.mcpServerEnabled", "Enable as MCP Server")}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t(
                          "agents.mcpServerEnabledDescription",
                          "Allow this agent to be used as an MCP server by other applications",
                        )}
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="mcp-server-enabled"
                    checked={currentAgent.mcpServerEnabled ?? false}
                    onCheckedChange={(checked) =>
                      setCurrentAgent((prev) => ({
                        ...prev,
                        mcpServerEnabled: checked,
                      }))
                    }
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
                {agent.mcpServers.length > 0 &&
                  agent.mcpServers.filter(
                    (server) =>
                      (agentState.serverVariables[server.id]?.length || 0) > 0,
                  ).length !== 0 &&
                  agent.mcpServers
                    .filter(
                      (server) =>
                        (agentState.serverVariables[server.id]?.length || 0) >
                        0,
                    )
                    .map((server) => (
                      <div
                        key={server.id}
                        className="pb-6 border-b last:border-b-0"
                      >
                        <div className="flex items-center mb-4">
                          <Server className="mr-2 h-5 w-5 text-muted-foreground" />
                          <h3 className="text-base font-medium">
                            {server.name}
                          </h3>
                        </div>

                        {agentState.serverInstructions[server.id] && (
                          <div className="p-3 bg-muted/50 rounded-md mb-5 whitespace-pre-line text-sm text-muted-foreground">
                            {agentState.serverInstructions[server.id]}
                          </div>
                        )}

                        <div className="space-y-5">
                          {agentState.serverVariables[server.id]?.map(
                            (variable) => (
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
                    ))}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <p>{t("agents.noServersConfigured")}</p>
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="advanced" className="mt-4 h-[calc(100%-3rem)]">
          <ScrollArea className="h-full overflow-auto">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="agent-name">{t("agents.fields.name")}</Label>
                <Input
                  id="agent-name"
                  value={currentAgent.name}
                  onChange={(e) =>
                    setCurrentAgent((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder={t("agents.placeholders.name")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent-purpose">
                  {t("agents.fields.purpose")}
                </Label>
                <Textarea
                  id="agent-purpose"
                  value={currentAgent.purpose}
                  onChange={(e) =>
                    setCurrentAgent((prev) => ({
                      ...prev,
                      purpose: e.target.value,
                    }))
                  }
                  placeholder={t("agents.placeholders.purpose")}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent-description">
                  {t("agents.fields.description")}
                </Label>
                <Textarea
                  id="agent-description"
                  value={currentAgent.description}
                  onChange={(e) =>
                    setCurrentAgent((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder={t("agents.placeholders.description")}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent-instructions">
                  {t("agents.fields.instructions")}
                </Label>
                <Textarea
                  id="agent-instructions"
                  value={currentAgent.instructions}
                  onChange={(e) =>
                    setCurrentAgent((prev) => ({
                      ...prev,
                      instructions: e.target.value,
                    }))
                  }
                  placeholder={t("agents.placeholders.instructions")}
                  rows={8}
                />
              </div>

              {/* MCP Servers Section */}
              <div className="border-t pt-6 mt-8">
                <McpSettings
                  agent={currentAgent}
                  setAgent={setAgentWithoutId}
                />
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AgentSettings;
