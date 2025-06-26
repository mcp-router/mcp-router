import { ipcMain, Notification } from "electron";
import { AgentConfig } from "@mcp-router/shared";
import {
  getDevelopmentAgentService,
  getDeployedAgentService,
  getAgentSharingService,
} from "@/main/services/agent";
import { backgroundWindow, mainWindow } from "../../main";
import { status } from "../auth";
import { getSessionRepository } from "../../lib/database";

/**
 * エージェント関連のIPC通信ハンドラをセットアップ
 */
export function setupAgentHandlers(): void {
  const developmentAgentService = getDevelopmentAgentService();
  const deployedAgentService = getDeployedAgentService();
  const agentSharingService = getAgentSharingService();
  const sessionRepository = getSessionRepository();
  // 開発中エージェント基本操作のIPC通信ハンドラ
  ipcMain.handle("agent:list", () => {
    return developmentAgentService.getAgents();
  });

  ipcMain.handle("agent:get", (_, id: string) => {
    return developmentAgentService.getAgentById(id);
  });

  ipcMain.handle("agent:create", (_, agentConfig: Omit<AgentConfig, "id">) => {
    return developmentAgentService.createAgent(agentConfig);
  });

  ipcMain.handle(
    "agent:update",
    (_, id: string, config: Partial<AgentConfig>) => {
      return developmentAgentService.updateAgent(id, config);
    },
  );

  ipcMain.handle("agent:delete", (_, id: string) => {
    return developmentAgentService.deleteAgent(id);
  });

  // 共有関連のIPC通信ハンドラ
  ipcMain.handle("agent:share", async (_, id: string) => {
    const agent = developmentAgentService.getAgentById(id);
    if (!agent) {
      throw new Error(`エージェントが見つかりません (ID: ${id})`);
    }
    return agentSharingService.shareAgent(agent);
  });

  ipcMain.handle("agent:import", async (_, shareCode: string) => {
    const sharedData = await agentSharingService.getSharedAgentData(shareCode);
    const deployedAgentData =
      agentSharingService.convertToDeployedAgent(sharedData);
    const result = deployedAgentService.createDeployedAgent(deployedAgentData);
    return result;
  });

  // エージェントデプロイ関連のIPC通信ハンドラ
  ipcMain.handle("agent:deploy", (_, id: string) => {
    const developmentAgent = developmentAgentService.getAgentById(id);
    if (!developmentAgent) {
      throw new Error(`開発中エージェントが見つかりません (ID: ${id})`);
    }
    const result =
      deployedAgentService.deployFromDevelopmentAgent(developmentAgent);
    return result;
  });

  ipcMain.handle("agent:deployed-list", () => {
    return deployedAgentService.getDeployedAgents();
  });

  ipcMain.handle("agent:deployed-update", (_, id: string, config: any) => {
    const result = deployedAgentService.updateDeployedAgent(id, config);
    return result;
  });

  ipcMain.handle("agent:deployed-delete", (_, id: string) => {
    const result = deployedAgentService.deleteDeployedAgent(id);
    return result;
  });

  // 特定のMCPサーバーのツールを取得するIPC通信ハンドラ
  ipcMain.handle(
    "agent:get-mcp-server-tools",
    async (_, agentId: string, serverId: string, isDev = false) => {
      try {
        // まずデプロイ済みエージェントを確認
        const deployedAgent =
          deployedAgentService.getDeployedAgentById(agentId);

        if (deployedAgent && !isDev) {
          // デプロイ済みエージェントの場合
          const result = await deployedAgentService.getAgentMCPServerTools(
            agentId,
            serverId,
          );
          return { success: true, tools: result };
        } else {
          // 開発中エージェントの場合
          const result = await developmentAgentService.getAgentMCPServerTools(
            agentId,
            serverId,
          );
          return { success: true, tools: result };
        }
      } catch (error) {
        return { success: false, error: error.message, tools: [] };
      }
    },
  );

  // エージェントツール実行のIPC通信ハンドラ
  ipcMain.handle(
    "agent:execute-tools",
    async (_, agentId: string, toolName: string, args: Record<string, any>) => {
      try {
        // まずデプロイ済みエージェントを確認
        const deployedAgent =
          deployedAgentService.getDeployedAgentById(agentId);

        if (deployedAgent) {
          // デプロイ済みエージェントの場合
          const result = await deployedAgentService.callAgentTool(
            agentId,
            toolName,
            args,
          );
          return {
            success: true,
            result,
          };
        } else {
          // 開発中エージェントの場合
          const result = await developmentAgentService.callAgentTool(
            agentId,
            toolName,
            args,
          );
          return {
            success: true,
            result,
          };
        }
      } catch (error) {
        console.error(
          `エージェント (ID: ${agentId}) でツール実行中にエラーが発生しました:`,
          error,
        );
        return {
          success: false,
          error: error.message,
        };
      }
    },
  );

  // バックグラウンドチャット関連のIPC通信ハンドラ
  ipcMain.handle(
    "agent:background-chat-start",
    async (
      _,
      sessionId: string | undefined,
      agentId: string,
      query: string,
    ) => {
      try {
        if (!backgroundWindow) {
          throw new Error("Background window not available");
        }

        // Get agent data
        const deployedAgent =
          deployedAgentService.getDeployedAgentById(agentId);
        if (!deployedAgent) {
          throw new Error(`Deployed agent not found (ID: ${agentId})`);
        }

        // Get authentication token from main process
        const authStatus = await status();
        const authToken = authStatus.token;

        // セッションが存在する場合、履歴を読み込む
        let messages = [];
        if (sessionId) {
          try {
            const session = sessionRepository.getById(sessionId);
            if (session && session.messages) {
              messages = session.messages;
              console.log(
                `Loaded ${messages.length} messages from session ${sessionId}`,
              );
            }
          } catch (error) {
            console.warn(
              `Failed to load session messages for ${sessionId}:`,
              error,
            );
            // 履歴読み込みに失敗しても続行
          }
        }

        // Send message to background window to start chat
        backgroundWindow.webContents.send("background-chat:start", {
          sessionId,
          agentId,
          query,
          agent: deployedAgent,
          authToken,
          messages, // 履歴も含めて送信
        });

        return { success: true };
      } catch (error) {
        console.error(
          `Background chat start failed for agent (ID: ${agentId}):`,
          error,
        );
        return {
          success: false,
          error: error.message,
        };
      }
    },
  );

  // バックグラウンドチャット停止のIPC通信ハンドラ
  ipcMain.handle("agent:background-chat-stop", async (_, agentId: string) => {
    try {
      if (!backgroundWindow) {
        throw new Error("Background window not available");
      }

      // Send stop message to background window
      backgroundWindow.webContents.send("background-chat:stop", {
        agentId,
      });

      return { success: true };
    } catch (error) {
      console.error(
        `Background chat stop failed for agent (ID: ${agentId}):`,
        error,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // チャットストリーム関連のIPC通信ハンドラ
  ipcMain.handle("agent:chat-stream-start", async (_, streamData) => {
    try {
      // セッションステータスをprocessingに更新
      if (streamData.chatHistorySessionId) {
        try {
          sessionRepository.updateSessionStatus(
            streamData.chatHistorySessionId,
            "processing",
          );
        } catch (error) {
          console.error(
            "Failed to update session status to processing:",
            error,
          );
        }
      }

      // メインウィンドウにストリーム開始を通知（MCPソースはスキップ）
      if (mainWindow && streamData.source !== "mcp") {
        mainWindow.webContents.send("chat-stream:start", streamData);
      }

      return { success: true };
    } catch (error) {
      console.error("Chat stream start failed:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("agent:chat-stream-chunk", async (_, chunkData) => {
    try {
      // メインウィンドウにストリームチャンクを転送（MCPソースはスキップ）
      if (mainWindow && chunkData.source !== "mcp") {
        mainWindow.webContents.send("chat-stream:chunk", chunkData);
      }
      return { success: true };
    } catch (error) {
      console.error("Chat stream chunk failed:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("agent:chat-stream-end", async (_, endData) => {
    try {
      // バックグラウンドウィンドウからのストリーム終了を受信
      // console.log('Chat stream ended:', endData);

      // メインウィンドウにストリーム終了を通知（MCPソースはスキップ）
      if (mainWindow && endData.source !== "mcp") {
        mainWindow.webContents.send("chat-stream:end", endData);
      }

      // セッションステータスをcompletedに更新
      if (
        endData.chatHistorySessionId &&
        endData.notificationType === "finish"
      ) {
        try {
          sessionRepository.updateSessionStatus(
            endData.chatHistorySessionId,
            "completed",
          );
        } catch (error) {
          console.error("Failed to update session status to completed:", error);
        }
      }

      // notificationTypeが'finish'の場合のみ通知を表示
      if (endData.agentId && endData.notificationType === "finish") {
        const agent = deployedAgentService.getDeployedAgentById(
          endData.agentId,
        );
        if (agent && Notification.isSupported()) {
          // MCPからの呼び出しかどうかでメッセージを変える
          const isMcpCall = endData.source === "mcp";
          const title = isMcpCall ? "MCP Agent Complete" : "Agent Complete";
          const body = isMcpCall
            ? `MCP Agent "${agent.name}" has completed processing the request.`
            : `Agent "${agent.name}" has completed processing your request.`;

          const notification = new Notification({
            title: `MCP Router - ${title}`,
            body,
            icon: undefined, // アイコンが必要な場合は後で追加
          });

          // 通知をクリックしたときにメインウィンドウにフォーカス
          notification.on("click", () => {
            if (mainWindow) {
              if (mainWindow.isMinimized()) mainWindow.restore();
              mainWindow.focus();
            }
          });

          notification.show();
        }
      }

      return { success: true };
    } catch (error) {
      console.error("Chat stream end failed:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("agent:chat-stream-error", async (_, errorData) => {
    try {
      // セッションステータスをfailedに更新
      if (errorData.chatHistorySessionId) {
        try {
          sessionRepository.updateSessionStatus(
            errorData.chatHistorySessionId,
            "failed",
          );
        } catch (error) {
          console.error("Failed to update session status to failed:", error);
        }
      }

      // メインウィンドウにストリームエラーを通知（MCPソースはスキップ）
      if (mainWindow && errorData.source !== "mcp") {
        mainWindow.webContents.send("chat-stream:error", errorData);
      }

      // notificationTypeが'error'の場合は通知を表示
      if (errorData.agentId && errorData.notificationType === "error") {
        const agent = deployedAgentService.getDeployedAgentById(
          errorData.agentId,
        );
        if (agent && Notification.isSupported()) {
          // MCPからの呼び出しかどうかでメッセージを変える
          const isMcpCall = errorData.source === "mcp";
          const title = isMcpCall ? "MCP Agent Error" : "Agent Error";
          const body = isMcpCall
            ? `MCP Agent "${agent.name}" encountered an error: ${errorData.error}`
            : `Agent "${agent.name}" encountered an error: ${errorData.error}`;

          const notification = new Notification({
            title: `MCP Router - ${title}`,
            body,
            icon: undefined, // アイコンが必要な場合は後で追加
          });

          // 通知をクリックしたときにメインウィンドウにフォーカス
          notification.on("click", () => {
            if (mainWindow) {
              if (mainWindow.isMinimized()) mainWindow.restore();
              mainWindow.focus();
            }
          });

          notification.show();
        }
      }

      return { success: true };
    } catch (error) {
      console.error("Chat stream error handling failed:", error);
      return { success: false, error: error.message };
    }
  });

  // セッションメッセージ取得のIPC通信ハンドラ（ローカルDB使用）
  ipcMain.handle(
    "agent:fetch-session-messages",
    async (_, sessionId: string) => {
      try {
        const session = sessionRepository.getById(sessionId);
        if (!session) {
          throw new Error(`Session not found (ID: ${sessionId})`);
        }
        return session.messages;
      } catch (error) {
        console.error(
          `Failed to fetch session messages for session (ID: ${sessionId}):`,
          error,
        );
        throw error;
      }
    },
  );

  // ローカルセッション管理のIPC通信ハンドラ
  ipcMain.handle(
    "agent:get-sessions",
    async (_, agentId: string, options: any = {}) => {
      try {
        const result = sessionRepository.getSessionsByAgent(agentId, options);
        return result;
      } catch (error) {
        console.error(
          `Failed to get sessions for agent (ID: ${agentId}):`,
          error,
        );
        throw error;
      }
    },
  );

  ipcMain.handle(
    "agent:create-session",
    async (_, agentId: string, initialMessages: any[] = []) => {
      try {
        const session = sessionRepository.createSession(
          agentId,
          initialMessages,
        );
        return session;
      } catch (error) {
        console.error(
          `Failed to create session for agent (ID: ${agentId}):`,
          error,
        );
        throw error;
      }
    },
  );

  ipcMain.handle(
    "agent:update-session-messages",
    async (_, sessionId: string, messages: any[]) => {
      try {
        const session = sessionRepository.updateSessionMessages(
          sessionId,
          messages,
        );
        if (!session) {
          throw new Error(`Session not found (ID: ${sessionId})`);
        }
        return session;
      } catch (error) {
        console.error(
          `Failed to update session messages (ID: ${sessionId}):`,
          error,
        );
        throw error;
      }
    },
  );

  ipcMain.handle("agent:delete-session", async (_, sessionId: string) => {
    try {
      const result = sessionRepository.delete(sessionId);
      return result;
    } catch (error) {
      console.error(`Failed to delete session (ID: ${sessionId}):`, error);
      throw error;
    }
  });
}
