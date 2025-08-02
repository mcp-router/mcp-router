import React, { useState, useEffect, useCallback } from "react";
import { useOutletContext, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AgentConfig, DeployedAgent } from "@mcp_router/shared";
import { AlertCircle } from "lucide-react";
import { cn } from "@/renderer/utils/tailwind-utils";
import { Message } from "@ai-sdk/react";
import ChatInterface from "@/renderer/components/agent/create/ChatInterface";
import ChatSessions from "./ChatSessions";
import { isAgentConfigured } from "@/main/domain/agent/shared/agent-utils";
import { useAgentStore } from "../../../stores";
import { usePlatformAPI } from "@/renderer/platform-api";
import { parseErrorMessage } from "@/renderer/utils/error-message-utils";

/**
 * エージェントチャットコンポーネント
 * エージェントとの会話を行う
 */
const AgentChat: React.FC = () => {
  const { agent } = useOutletContext<{
    agent: DeployedAgent;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const platformAPI = usePlatformAPI();

  // Zustand store
  const {
    authToken,
    currentSessionId,
    chatSessions,
    isLoadingSessions,
    isLoadingMoreSessions,
    hasMoreSessions,
    sessionsError,
    deletingSessions,
    messages,
    currentStreamMessage,
    isStreaming,
    setCurrentDeployedAgent,
    setCurrentSessionId,
    fetchAuthToken,
    fetchChatSessions,
    loadMoreSessions,
    deleteChatSession,
    resetSessions,
    setMessages,
    addMessage,
    updateMessage,
    setCurrentStreamMessage,
    setIsStreaming,
    resetChatState,
  } = useAgentStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isCallingTool, setIsCallingTool] = useState(false);
  const [needsAutoSelection, setNeedsAutoSelection] = useState(false);

  // Get authentication token from store (continue without it if not available)
  useEffect(() => {
    fetchAuthToken();
  }, [fetchAuthToken]);

  // Reset session when agent changes
  useEffect(() => {
    setCurrentSessionId(null);
    setCurrentDeployedAgent(agent);
    resetSessions();

    // Reset chat state including messages
    resetChatState(agent?.id || "", agent?.instructions || "");

    // Reset local state
    setIsLoading(false);
    setIsCallingTool(false);
    setError(undefined);
  }, [
    agent?.id,
    agent?.instructions,
    setCurrentSessionId,
    setCurrentDeployedAgent,
    resetSessions,
    resetChatState,
  ]);

  // Cleanup when component unmounts or route changes away from chat
  useEffect(() => {
    return () => {
      // Reset chat state when leaving the chat page
      resetChatState("", "");
      setCurrentSessionId(null);
      resetSessions();
    };
  }, [resetChatState, setCurrentSessionId, resetSessions]);

  // Reset when navigating away from chat page
  useEffect(() => {
    const currentPath = location.pathname;

    // If not on a chat page, reset the chat state
    if (!currentPath.includes("/chat")) {
      resetChatState("", "");
      setCurrentSessionId(null);
      resetSessions();
    }
  }, [location.pathname, resetChatState, setCurrentSessionId, resetSessions]);

  // 初回ロード時とagentIdが変更された時にセッション一覧を取得
  useEffect(() => {
    if (agent?.id) {
      fetchChatSessions(agent.id);
    }
  }, [agent?.id, fetchChatSessions]);

  // Auto-select the newest session after it's created
  useEffect(() => {
    if (needsAutoSelection && chatSessions.length > 0 && !currentSessionId) {
      setCurrentSessionId(chatSessions[0].id);
      setNeedsAutoSelection(false);
    }
  }, [needsAutoSelection, chatSessions, currentSessionId, setCurrentSessionId]);

  // セッションを削除 (using store method)
  const deleteSession = useCallback(
    async (sessionIdToDelete: string) => {
      try {
        // 削除前に現在選択中のセッションかチェック
        const isCurrentSession = sessionIdToDelete === currentSessionId;

        await deleteChatSession(sessionIdToDelete);

        // 削除されたセッションが現在選択中だった場合、セッションをリセット
        if (isCurrentSession) {
          setCurrentSessionId(null);
          // メッセージリセットはuseEffectで処理される
        }

        // セッション一覧を再取得して最新状態にする
        if (agent?.id) {
          await fetchChatSessions(agent.id);
        }
      } catch (err) {
        console.error("Failed to delete session:", err);
        console.error("Failed to delete session:", err);
      }
    },
    [
      deleteChatSession,
      currentSessionId,
      agent?.id,
      authToken,
      fetchChatSessions,
    ],
  );

  // Session management handlers
  const handleSessionSelect = (selectedSessionId: string | null) => {
    setCurrentSessionId(selectedSessionId);
  };

  const handleNewSession = () => {
    setCurrentSessionId(null);
  };

  const selectedSession = React.useMemo(() => {
    if (!currentSessionId) return null;
    return chatSessions.find((session) => session.id === currentSessionId);
  }, [chatSessions, currentSessionId]);

  // ツールデータの準備
  const getEnabledTools = React.useMemo(() => {
    if (!agent) return [];

    const tools: { name: string; description?: string; inputSchema?: any }[] =
      [];

    // toolPermissions（AgentConfig形式）からツール権限を取得する方法
    if ((agent as AgentConfig).toolPermissions) {
      const toolPermissions = (agent as AgentConfig).toolPermissions;

      if (toolPermissions) {
        Object.entries(toolPermissions).forEach(([_serverId, toolsArray]) => {
          if (Array.isArray(toolsArray)) {
            toolsArray.forEach((tool) => {
              if (tool.enabled) {
                tools.push({
                  name: tool.toolName,
                  description: tool.description || "",
                  inputSchema: tool.inputSchema || {},
                });
              }
            });
          }
        });
      }
    }

    return tools;
  }, [agent]);

  // Messages are now managed by Zustand store
  const [input, setInput] = useState("");
  const [error, setError] = useState<Error | undefined>(undefined);

  // Stream state is now managed by Zustand store

  // Chat Stream Event Handlers
  useEffect(() => {
    const unsubscribeStart = platformAPI.agents.stream.onStart((data: any) => {
      // Check if this stream is for the current agent
      if (data.agentId === agent?.id) {
        setIsStreaming(true);
        setIsLoading(true);

        // Create a new assistant message for streaming
        const streamMessage: Message = {
          id: `assistant-stream-${Date.now()}`,
          role: "assistant",
          content: "",
          parts: [{ type: "text", text: "" }],
        };

        setCurrentStreamMessage(streamMessage);
      }
    });

    const unsubscribeChunk = platformAPI.agents.stream.onChunk((data: any) => {
      // console.log('Stream chunk received in AgentChat:', {
      //     agentId: data.agentId,
      //     currentAgentId: agent?.id,
      //     isStreaming,
      //     chunkLength: data.chunk?.length,
      //     messageId: data.messageId,
      //     isToolInvocation: data.isToolInvocation,
      //     isCompleteMessage: data.isCompleteMessage,
      //     hasCompleteMessage: !!data.completeMessage,
      //     chunk: data.chunk?.substring(0, 100) + (data.chunk?.length > 100 ? '...' : '')
      // });

      // Check if this chunk is for the current agent
      if (data.agentId === agent?.id) {
        // ツール呼び出しメッセージの場合は、メッセージ配列に直接追加
        if (
          data.isToolInvocation &&
          data.completeMessage &&
          data.isCompleteMessage
        ) {
          const completeMessage = data.completeMessage as Message;

          // ツール呼び出し中はローディング状態を維持
          if (!isLoading) {
            setIsLoading(true);
          }

          // ツール実行結果が含まれている場合は、isCallingToolをfalseにする
          const hasToolResults = completeMessage.parts?.some(
            (part) =>
              part.type === "tool-invocation" &&
              part.toolInvocation?.state === "result",
          );

          if (hasToolResults) {
            setIsCallingTool(false);
          }

          // 完全なメッセージをstoreに追加
          const existingIndex = messages.findIndex(
            (msg) => msg.id === completeMessage.id,
          );
          if (existingIndex >= 0) {
            updateMessage(completeMessage.id, completeMessage);
          } else {
            addMessage(completeMessage);
          }

          return; // ツール呼び出しメッセージの場合は、ストリーミング処理をスキップ
        }

        // 通常のアシスタントメッセージの場合のストリーミング処理
        if (!data.isToolInvocation) {
          // ストリーミング状態を開始（まだ開始していない場合）
          if (!isStreaming) {
            setIsStreaming(true);
            setIsLoading(true);
          }

          // ストリームメッセージを更新
          const newMessage = {
            id: data.messageId || `assistant-stream-${Date.now()}`,
            role: "assistant" as const,
            content: data.chunk,
            parts: [{ type: "text" as const, text: data.chunk }],
          };

          setCurrentStreamMessage(newMessage);
        }
      }
    });

    const unsubscribeEnd = platformAPI.agents.stream.onEnd((data: any) => {
      // console.log('Stream end received:', {
      //     agentId: data.agentId,
      //     currentAgentId: agent?.id,
      //     isStreaming,
      //     finishReason: data.finishReason,
      //     willProcess: data.agentId === agent?.id
      // });
      // Check if this end event is for the current agent
      // Remove isStreaming check since it might already be false when this event arrives
      if (data.agentId === agent?.id) {
        setIsStreaming(false);

        // Handle different finish reasons
        if (data.finishReason === "stop") {
          setIsLoading(false);
          setIsCallingTool(false);

          // Refresh sessions list after a short delay to ensure server has saved the session
          const wasNewSession = !currentSessionId;
          setTimeout(async () => {
            await fetchChatSessions(agent.id);

            // If this was a new session, auto-select the most recent session
            if (wasNewSession) {
              // Use a state flag to trigger auto-selection after sessions are loaded
              setNeedsAutoSelection(true);
            }
          }, 1000); // 1 second delay
        } else if (data.finishReason === "tool-calls") {
          setIsCallingTool(true);
        } else if (data.finishReason === "tool-results") {
          // Tool results have been received, reset tool calling state
          setIsCallingTool(false);
          setIsLoading(false);
        } else {
          // For other finish reasons (like 'length'), keep both states as they are
          setIsCallingTool(false);
        }
        // Add the completed message to the store (with duplication check)
        if (currentStreamMessage) {
          const existingIndex = messages.findIndex(
            (msg) => msg.id === currentStreamMessage.id,
          );
          if (existingIndex >= 0) {
            updateMessage(currentStreamMessage.id, currentStreamMessage);
          } else {
            addMessage(currentStreamMessage);
          }
          setCurrentStreamMessage(null);
        }
      }
    });

    const unsubscribeError = platformAPI.agents.stream.onError((data: any) => {
      // Check if this error is for the current agent
      if (data.agentId === agent?.id) {
        setIsStreaming(false);
        setIsLoading(false);
        setIsCallingTool(false);
        setCurrentStreamMessage(null);

        // Parse error message for better display
        const parsedError = parseErrorMessage(
          data.error || "Stream error occurred",
        );
        const errorMessage = parsedError.displayMessage;

        // Create error object with parsed message
        const error = new Error(errorMessage);
        if (parsedError.isPaymentError) {
          // Add payment error info to error object
          (error as any).isPaymentError = true;
          (error as any).purchaseUrl = parsedError.purchaseUrl;
        }

        setError(error);
      }
    });

    return () => {
      unsubscribeStart?.();
      unsubscribeChunk?.();
      unsubscribeEnd?.();
      unsubscribeError?.();
    };
  }, [
    agent?.id,
    isStreaming,
    currentStreamMessage,
    currentSessionId,
    messages,
    addMessage,
    updateMessage,
    setCurrentStreamMessage,
    setIsStreaming,
  ]);

  // Input change handler
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setInput(e.target.value);
  };

  // Custom submit handler - delegates to background component
  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      // ロード中（ツール実行中を含む）またはinputが空の場合は何もしない
      if (isLoading || !input.trim() || !agent?.id) {
        return;
      }

      // ロード状態を開始
      setIsLoading(true);
      // Clear any previous errors when sending a new message
      setError(undefined);

      try {
        // Start background chat with the query
        const result = await platformAPI.agents.background.start(
          currentSessionId || undefined,
          agent.id,
          input.trim(),
        );

        if (result.success) {
          // Add user message to store for display
          const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: "user",
            content: input.trim(),
            parts: [{ type: "text", text: input.trim() }],
          };

          addMessage(userMessage);
          setInput("");
        } else {
          throw new Error(result.error || "Failed to start background chat");
        }
      } catch (error) {
        console.error("Failed to start background chat:", error);

        // Parse error message if it's an error object
        if (error instanceof Error) {
          const parsedError = parseErrorMessage(error.message);
          const displayError = new Error(parsedError.displayMessage);
          if (parsedError.isPaymentError) {
            (displayError as any).isPaymentError = true;
            (displayError as any).purchaseUrl = parsedError.purchaseUrl;
          }
          setError(displayError);
        } else {
          setError(new Error("Unknown error"));
        }

        // Only set loading to false on error
        setIsLoading(false);
      }
      // Do not set loading to false in finally block
      // Loading state will be managed by stream events
    },
    [input, isLoading, agent?.id, currentSessionId, isStreaming, addMessage],
  );

  // カスタムのstop関数を作成
  const customStop = useCallback(async () => {
    if (!agent?.id) return;

    try {
      // Stop the background chat process
      await platformAPI.agents.background.stop(agent.id);

      // Update state
      setIsLoading(false);
      setIsStreaming(false);
      setIsCallingTool(false);
      setCurrentStreamMessage(null);
    } catch (error) {
      console.error("Failed to stop background chat:", error);
      // Still update state even if API call fails
      setIsLoading(false);
      setIsStreaming(false);
      setIsCallingTool(false);
      setCurrentStreamMessage(null);
    }
  }, [agent?.id, setIsStreaming, setCurrentStreamMessage]);

  // Set messages from selected session when currentSessionId changes
  useEffect(() => {
    if (selectedSession) {
      // Use messages from the session (already fetched by fetchChatSessions)
      if (selectedSession.messages && selectedSession.messages.length > 0) {
        console.log(selectedSession.messages);
        // Filter out system messages when setting from session to avoid duplication
        const sessionMessages = selectedSession.messages
          .filter((msg) => msg.role !== "system")
          .map((msg) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content || "",
            parts: msg.parts || [
              { type: "text" as const, text: msg.content || "" },
            ],
          }));
        setMessages([
          // Always include the system message
          {
            id: "system-1",
            role: "system",
            content: agent?.instructions || "",
            parts: [{ type: "text" as const, text: agent?.instructions || "" }],
          },
          ...sessionMessages,
        ]);
      } else {
        // Session exists but has no messages (empty session)
        setMessages([
          // Always include the system message
          {
            id: "system-1",
            role: "system",
            content: agent?.instructions || "",
            parts: [{ type: "text" as const, text: agent?.instructions || "" }],
          },
        ]);
      }
    } else if (currentSessionId === null) {
      // New session - reset chat state
      resetChatState(agent?.id || "", agent?.instructions || "");

      // Also reset all related local state when starting new session
      setIsLoading(false);
      setIsCallingTool(false);
      setError(undefined);
      setInput(""); // Clear input field for new session
    }
  }, [
    currentSessionId,
    selectedSession?.messages,
    selectedSession?.id,
    agent?.id,
    agent?.instructions,
    setMessages,
    resetChatState,
  ]);

  // Function to handle tool call confirmations from the UI
  const handleToolConfirmation = async (
    toolCallId: string,
    toolName: string,
    args: any,
    confirmed: boolean,
  ) => {
    if (confirmed) {
      try {
        // User approved - execute the tool
        const result = await platformAPI.agents.tools.execute(
          agent.id,
          toolName,
          args,
        );

        if (!result.success) {
          throw new Error(result.error || "Tool execution failed");
        }
      } catch (error) {
        console.error("Tool execution error:", error);
      }
    }
  };

  const agentForChat: AgentConfig = {
    ...(agent as DeployedAgent),
    autoExecuteTool: agent.autoExecuteTool ?? true,
  } as AgentConfig;

  // Combine regular messages with current streaming message for display
  const displayMessages = React.useMemo(() => {
    let result = messages;

    // Add streaming message if it exists and we're streaming
    if (currentStreamMessage && isStreaming) {
      // Check if streaming message already exists in messages array
      const existingIndex = messages.findIndex(
        (msg) => msg.id === currentStreamMessage.id,
      );
      if (existingIndex >= 0) {
        // Replace existing message with streaming version
        result = [...messages];
        result[existingIndex] = currentStreamMessage;
      } else {
        // Add new streaming message
        result = [...messages, currentStreamMessage];
      }
    }

    return result;
  }, [messages, currentStreamMessage, isStreaming]);

  // Log errors for debugging
  useEffect(() => {
    if (error) {
      console.error("Chat error:", error);
    }
  }, [error]);

  return (
    <div className="flex flex-col flex-grow overflow-hidden relative">
      {/* Unconfigured Overlay */}
      {!isAgentConfigured(agent) && (
        <div className="absolute inset-0 bg-background/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
          <div
            onClick={() => navigate(`/agents/use/${agent.id}/settings`)}
            className="max-w-md text-center p-6 bg-card border rounded-lg shadow-lg cursor-pointer hover:bg-card/80 transition-colors"
          >
            <AlertCircle className="h-16 w-16 text-warning mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">
              {t("agents.chat.configurationIncomplete")}
            </h3>
            <p className="text-muted-foreground mb-4">
              {t("agents.chat.configurationIncompleteDescription")}
            </p>
          </div>
        </div>
      )}

      {/* Sessions Header - Always show ChatSessions component */}
      <div className="flex-shrink-0">
        <ChatSessions
          currentSessionId={currentSessionId ?? undefined}
          onSessionSelect={handleSessionSelect}
          onNewSession={handleNewSession}
          sessions={chatSessions}
          isLoading={isLoadingSessions}
          isLoadingMore={isLoadingMoreSessions}
          hasMore={hasMoreSessions}
          error={sessionsError}
          onLoadMore={loadMoreSessions}
          onDeleteSession={deleteSession}
          deletingSessions={deletingSessions}
        />
      </div>

      {/* Chat Interface */}
      <div
        className={cn(
          "flex-grow flex flex-col overflow-hidden",
          !isAgentConfigured(agent) && "opacity-50 pointer-events-none",
        )}
      >
        <ChatInterface
          agent={agentForChat}
          messages={displayMessages}
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          servers={agent.mcpServers}
          enabledTools={getEnabledTools}
          onToolConfirmation={handleToolConfirmation}
          stop={customStop}
          isLoading={isLoading || isStreaming}
          isCallingTool={isCallingTool}
          error={error}
        />
      </div>
    </div>
  );
};

export default AgentChat;
