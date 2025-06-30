import { FC, useEffect, useState, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { Button } from "@mcp-router/ui";
import { Settings, X } from "lucide-react";
import { toast } from "sonner";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@mcp-router/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@mcp-router/ui";
import { AgentConfig, MCPServerConfig } from "@mcp-router/shared";
import { useTranslation } from "react-i18next";
import ChatInterface from "./ChatInterface";
import ServerSettingsForm from "./ServerSettingsForm";
import { usePlatformAPI } from "@/lib/platform-api";

interface AgentChatPlaygroundProps {
  agent?: AgentConfig;
  onCloseTest?: () => void;
  onUpdateAgent?: (updatedAgent: Partial<AgentConfig>) => void;
}

const AgentChatPlayground: FC<AgentChatPlaygroundProps> = ({
  agent,
  onCloseTest,
  onUpdateAgent,
}) => {
  const [isSettingsView, setIsSettingsView] = useState(false);
  const [selectedServers, setSelectedServers] = useState<MCPServerConfig[]>([]);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();
  const platformAPI = usePlatformAPI();

  // Get authentication token from Electron API
  useEffect(() => {
    const fetchAuthToken = async () => {
      try {
        const status = await platformAPI.auth.getStatus();
        if (status.authenticated && status.token) {
          setAuthToken(status.token);
        }
      } catch (error) {
        console.error("Error fetching authentication token:", error);
      }
    };

    fetchAuthToken();
  }, []);

  // Reset session when agent changes
  useEffect(() => {
    setSessionId(null);
  }, [agent?.id]);

  // Extract tools data from the selected servers and agent configuration
  const getEnabledTools = useMemo(() => {
    if (!agent || !selectedServers || selectedServers.length === 0) return [];

    const toolsList: {
      name: string;
      description?: string;
      inputSchema?: any;
    }[] = [];

    // If agent has toolPermissions defined, extract enabled tools
    if (agent.toolPermissions) {
      // Iterate over server permissions
      Object.entries(agent.toolPermissions).forEach(
        ([serverId, toolsArray]) => {
          if (Array.isArray(toolsArray)) {
            toolsArray.forEach((tool) => {
              if (tool.enabled) {
                toolsList.push({
                  name: tool.toolName,
                  inputSchema: tool.inputSchema,
                  description: tool.description || "",
                });
              }
            });
          }
        },
      );
    }

    return toolsList;
  }, [agent, selectedServers]);

  // 通常チャット用のuseChat
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    error,
    data,
    addToolResult,
    stop,
  } = useChat({
    api: "https://mcp-router.net/api/agent/chat/use",
    body: {
      agentId: agent?.id || "",
      tools: getEnabledTools,
      sessionId: sessionId || undefined,
    },
    headers: authToken
      ? {
          Authorization: `Bearer ${authToken}`,
        }
      : undefined, // Continue without auth headers if no token available
    initialMessages: [
      // システムメッセージとしてエージェントの指示（instruction）を追加
      {
        id: "system-1",
        role: "system",
        content: agent?.instructions || "",
        parts: [{ type: "text", text: agent?.instructions || "" }],
      },
    ],
    onToolCall: async ({ toolCall }) => {
      if (agent?.autoExecuteTool) {
        // 自動実行が有効な場合、ツールを即座に実行
        try {
          const result = await platformAPI.agents.tools.execute(
            agent.id,
            toolCall.toolName,
            toolCall.args as any,
          );

          if (result.success) {
            addToolResult({
              toolCallId: toolCall.toolCallId,
              result: result.result,
            });
          } else {
            addToolResult({
              toolCallId: toolCall.toolCallId,
              result: { error: result.error || "Tool execution failed" },
            });
          }
        } catch (error) {
          console.error("Auto tool execution error:", error);
          addToolResult({
            toolCallId: toolCall.toolCallId,
            result: {
              error:
                error instanceof Error
                  ? error.message
                  : "Auto tool execution failed",
            },
          });
        }
      }
      // 手動実行の場合は、ChatInterfaceのUIから確認後にhandleToolConfirmationが呼ばれる
    },
    onFinish: (message, options) => {
      // stopの場合のみロード状態を終了
      if (options.finishReason === "stop") {
        setIsLoading(false);
      }
    },
  });

  // カスタムのhandleSubmitを作成
  const customHandleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isLoading && input.trim()) {
      setIsLoading(true);
      handleSubmit(e);
    }
  };

  // カスタムのstop関数を作成
  const customStop = () => {
    stop();
    setIsLoading(false);
  };

  // console.log(messages);

  // Initialize selectedServers with agent's MCP servers if available
  useEffect(() => {
    if (agent && agent.mcpServers && agent.mcpServers.length > 0) {
      setSelectedServers(agent.mcpServers);
    }
  }, [agent]);

  const toggleSettingsView = () => {
    setIsSettingsView(!isSettingsView);
  };

  // Function to handle tool call confirmations from the UI
  const handleToolConfirmation = async (
    toolCallId: string,
    toolName: string,
    args: any,
    confirmed: boolean,
  ) => {
    if (confirmed) {
      try {
        // Execute the tool
        const result = await platformAPI.agents.tools.execute(
          agent!.id,
          toolName,
          args,
        );

        if (!result.success) {
          throw new Error(result.error || "Tool execution failed");
        }

        // Send the result back to the LLM
        addToolResult({
          toolCallId,
          result: result.result,
        });
      } catch (error) {
        console.error("Tool execution error:", error);
        // For errors, we still need to provide a result, but it will contain the error information
        const errorMessage =
          error instanceof Error ? error.message : "Tool execution failed";
        addToolResult({
          toolCallId,
          result: { error: errorMessage },
        });
        toast.error(`Tool execution failed: ${errorMessage}`);
      }
    } else {
      // User denied - return as a result with error information
      addToolResult({
        toolCallId,
        result: { error: "User denied tool execution" },
      });
    }
  };

  // Function to handle agent updates from settings form
  const handleAgentUpdate = (updatedConfig: Partial<AgentConfig>) => {
    if (onUpdateAgent) {
      // Send the update to the parent component
      onUpdateAgent(updatedConfig);

      // If we have mcpServers in the update, also update our local state
      if (updatedConfig.mcpServers) {
        setSelectedServers(updatedConfig.mcpServers);
      }

      // Show success message
      toast.success(t("agents.settingsUpdated"));
    }
  };

  // Handle server updates
  const handleServerUpdate = (updatedServers: MCPServerConfig[]) => {
    setSelectedServers(updatedServers);
    if (onUpdateAgent) {
      onUpdateAgent({ mcpServers: updatedServers });
    }
  };

  // エラーが発生した場合はトーストを表示
  useEffect(() => {
    if (error) {
      toast.error(t("agents.errors.chatError"));
      console.error("Chat error:", error);
    }
  }, [error]);

  return (
    <div className="flex flex-col h-full">
      {isSettingsView ? (
        // 設定ビュー
        <div className="h-[calc(100vh-10rem)] flex flex-col overflow-hidden">
          <div className="flex justify-between items-center px-6 pt-4 mb-2">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <button
                      onClick={toggleSettingsView}
                      className="hover:underline flex items-center focus:outline-none"
                    >
                      {agent?.name || t("agents.title")}
                    </button>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{t("common.settings")}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleSettingsView}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("common.close")}</TooltipContent>
            </Tooltip>
          </div>

          <div className="px-6 flex-1 overflow-hidden">
            <ServerSettingsForm
              agent={agent!}
              setAgent={handleAgentUpdate}
              selectedServers={selectedServers}
              setSelectedServers={handleServerUpdate}
              onSave={toggleSettingsView}
              onBack={toggleSettingsView}
            />
          </div>
        </div>
      ) : (
        // 通常チャットビュー
        <div className="h-[calc(100vh-10rem)] flex flex-col overflow-hidden">
          <div className="flex justify-between items-center px-6 pt-4 mb-2">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>
                    {agent?.name || t("agents.title")}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleSettingsView}
                    className="h-8 w-8 mr-2"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("common.settings")}</TooltipContent>
              </Tooltip>
              {onCloseTest && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onCloseTest}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("common.close")}</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {agent && (
            <ChatInterface
              agent={agent}
              messages={messages}
              input={input}
              handleInputChange={handleInputChange}
              handleSubmit={customHandleSubmit}
              placeholder={t("agents.enterMessage")}
              servers={selectedServers}
              enabledTools={getEnabledTools}
              onToolConfirmation={handleToolConfirmation}
              stop={customStop}
              isLoading={isLoading}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default AgentChatPlayground;
