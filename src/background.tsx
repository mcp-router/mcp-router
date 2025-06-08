import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import BackgroundComponent from './components/agent/BackgroundComponent';
import './global.css';

// Create a container component that manages chat sessions
const BackgroundChatManager: React.FC = () => {
  const [chatSessions, setChatSessions] = useState<Map<string, any>>(new Map());
  
  // セッション完了時のコールバック
  const handleSessionComplete = (backgroundSessionKey: string) => {
    console.log('Removing completed session from memory:', backgroundSessionKey);
    setChatSessions(prev => {
      const newSessions = new Map(prev);
      newSessions.delete(backgroundSessionKey);
      console.log('Remaining sessions:', newSessions.size);
      return newSessions;
    });
  };
  
  React.useEffect(() => {
    // Listen for background chat start messages
    const handleBackgroundChatStart = (data: any) => {
      const { sessionId, agentId, query, agent, authToken } = data;
      // sessionId: チャット履歴のsessionId (AgentChatから渡される)
      // backgroundSessionKey: Background内部での管理用キー
      const backgroundSessionKey = `bg-${agentId}-${Date.now()}`;
      
      console.log('Starting background chat:', { 
        chatHistorySessionId: sessionId, 
        backgroundSessionKey, 
        agentId, 
        query, 
        hasAuthToken: !!authToken 
      });
      
      setChatSessions(prev => {
        // Background内部のキーで重複チェック
        if (prev.has(backgroundSessionKey)) {
          console.log('Background session already exists, skipping:', backgroundSessionKey);
          return prev;
        }
        
        const newSessions = new Map(prev);
        newSessions.set(backgroundSessionKey, {
          chatHistorySessionId: sessionId, // チャット履歴のsessionId
          agentId,
          query,
          agent,
          authToken
        });
        console.log('Added new background session:', backgroundSessionKey, 'for chat history session:', sessionId);
        return newSessions;
      });
    };
    
    // Register IPC listener
    let cleanup: (() => void) | undefined;
    
    if (window.electronAPI?.onBackgroundChatStart) {
      cleanup = window.electronAPI.onBackgroundChatStart(handleBackgroundChatStart);
    } else {
      console.warn('electronAPI.onBackgroundChatStart not available');
    }
    
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, []);
  
  return (
    <div>
      <div>Background Chat Service Ready - Sessions: {chatSessions.size}</div>
      <div>Active Sessions: {Array.from(chatSessions.keys()).join(', ')}</div>
      {Array.from(chatSessions.entries()).map(([backgroundSessionKey, sessionData]) => {
        console.log('Rendering BackgroundComponent for background session:', backgroundSessionKey, 'chat history session:', sessionData.chatHistorySessionId);
        return (
          <BackgroundComponent
            key={backgroundSessionKey}
            backgroundSessionKey={backgroundSessionKey}
            chatHistorySessionId={sessionData.chatHistorySessionId}
            agentId={sessionData.agentId}
            query={sessionData.query}
            agent={sessionData.agent}
            authToken={sessionData.authToken}
            onSessionComplete={handleSessionComplete}
          />
        );
      })}
    </div>
  );
};

// Create a root container for the background component
const container = document.getElementById('background-root');
const root = createRoot(container);
root.render(<BackgroundChatManager />);
