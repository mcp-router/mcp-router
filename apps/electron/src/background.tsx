import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import BackgroundComponent from "@/frontend/components/agent/BackgroundComponent";
import { PlatformAPIProvider } from "@mcp-router/platform-api";
import { electronPlatformAPI } from "@/frontend/lib/electron-platform-api";
import "@mcp-router/tailwind-config/base.css";

// Create a container component that manages chat sessions
const BackgroundChatManager: React.FC = () => {
  const [chatSessions, setChatSessions] = useState<Map<string, any>>(new Map());

  // セッション完了時のコールバック
  const handleSessionComplete = (backgroundSessionKey: string) => {
    console.log(
      "Removing completed session from memory:",
      backgroundSessionKey,
    );
    setChatSessions((prev) => {
      const newSessions = new Map(prev);
      newSessions.delete(backgroundSessionKey);
      console.log("Remaining sessions:", newSessions.size);
      return newSessions;
    });
  };

  React.useEffect(() => {
    // Listen for background chat start messages
    const handleBackgroundChatStart = (data: any) => {
      const { sessionId, agentId, query, agent, authToken, messages, source } =
        data;
      // sessionId: チャット履歴のsessionId (AgentChatから渡される)
      // backgroundSessionKey: Background内部での管理用キー
      const backgroundSessionKey = `bg-${agentId}-${Date.now()}`;

      // console.log('Starting background chat:', {
      //   chatHistorySessionId: sessionId,
      //   backgroundSessionKey,
      //   agentId,
      //   query,
      //   hasAuthToken: !!authToken,
      //   source
      // });

      setChatSessions((prev) => {
        // Background内部のキーで重複チェック
        if (prev.has(backgroundSessionKey)) {
          console.log(
            "Background session already exists, skipping:",
            backgroundSessionKey,
          );
          return prev;
        }

        const newSessions = new Map(prev);
        newSessions.set(backgroundSessionKey, {
          chatHistorySessionId: sessionId, // チャット履歴のsessionId
          agentId,
          query,
          agent,
          authToken,
          messages, // 履歴メッセージを追加
          source, // 呼び出し元を追加
        });
        console.log(
          "Added new background session:",
          backgroundSessionKey,
          "for chat history session:",
          sessionId,
        );
        return newSessions;
      });
    };

    // Register IPC listener
    let cleanup: (() => void) | undefined;

    cleanup = electronPlatformAPI.onBackgroundChatStart(
      handleBackgroundChatStart,
    );

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  return (
    <div>
      <div>Background Chat Service Ready - Sessions: {chatSessions.size}</div>
      <div>Active Sessions: {Array.from(chatSessions.keys()).join(", ")}</div>
      {Array.from(chatSessions.entries()).map(
        ([backgroundSessionKey, sessionData]) => {
          console.log(
            "Rendering BackgroundComponent for background session:",
            backgroundSessionKey,
            "chat history session:",
            sessionData.chatHistorySessionId,
          );
          return (
            <BackgroundComponent
              key={backgroundSessionKey}
              backgroundSessionKey={backgroundSessionKey}
              chatHistorySessionId={sessionData.chatHistorySessionId}
              agentId={sessionData.agentId}
              query={sessionData.query}
              agent={sessionData.agent}
              authToken={sessionData.authToken}
              messages={sessionData.messages}
              source={sessionData.source}
              onSessionComplete={handleSessionComplete}
            />
          );
        },
      )}
    </div>
  );
};

// Create a root container for the background component
const container = document.getElementById("background-root");
if (container) {
  const root = createRoot(container);
  root.render(
    <PlatformAPIProvider platformAPI={electronPlatformAPI}>
      <BackgroundChatManager />
    </PlatformAPIProvider>,
  );
} else {
  console.error("Background root element not found");
}
