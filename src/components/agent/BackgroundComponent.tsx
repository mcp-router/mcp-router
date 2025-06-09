import React, { useEffect, useState, useRef } from 'react';
import { useChat, Message } from '@ai-sdk/react';
import { AgentConfig } from '../../types';
import { getServerAgentId } from '../../lib/utils/agent-utils';

interface BackgroundComponentProps {
  chatHistorySessionId?: string; // チャット履歴のsessionId
  agentId: string;
  query: string;
  agent: AgentConfig;
  authToken?: string;
  messages?: any[]; // 事前に読み込まれた履歴メッセージ
  onSessionComplete?: (backgroundSessionKey: string) => void; // セッション完了時のコールバック
  backgroundSessionKey: string; // Background内部のセッションキー
}

/**
 * バックグラウンドでチャット処理を行うコンポーネント
 * AgentChatから分離して、実際のuseChat処理を担当
 */
const BackgroundComponent: React.FC<BackgroundComponentProps> = ({
  chatHistorySessionId,
  agentId,
  query,
  agent,
  authToken,
  messages: historyMessages = [],
  onSessionComplete,
  backgroundSessionKey
}) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [shouldSaveSession, setShouldSaveSession] = useState(false);

  // ツールデータの準備
  const getEnabledTools = React.useMemo(() => {
    if (!agent) return [];
    
    const tools: { name: string; description?: string; inputSchema?: any }[] = [];

    // toolPermissions（AgentConfig形式）からツール権限を取得する方法
    if (agent.toolPermissions) {
      const toolPermissions = agent.toolPermissions;
      
      Object.entries(toolPermissions).forEach(([_serverId, toolsArray]) => {
        if (Array.isArray(toolsArray)) {
          toolsArray.forEach(tool => {
            if (tool.enabled) {
              tools.push({
                name: tool.toolName,
                description: tool.description || '',
                inputSchema: tool.inputSchema || {}
              });
            }
          });
        }
      });
    }
    
    return tools;
  }, [agent]);

  // 履歴メッセージをinitial messagesとして設定
  const initialMessages = React.useMemo(() => {
    const messages: any[] = [];
    
    // システムメッセージを追加
    messages.push({
      id: 'system-1',
      role: 'system',
      content: agent?.instructions || '',
      parts: [
        { type: 'text', text: agent?.instructions || '' }
      ],
    });
    
    // 履歴メッセージを追加（システムメッセージ以外）
    if (historyMessages && historyMessages.length > 0) {
      const nonSystemMessages = historyMessages.filter((msg: any) => msg.role !== 'system');
      messages.push(...nonSystemMessages.map((msg: any) => ({
        id: msg.id || `${msg.role}-${Date.now()}-${Math.random()}`,
        role: msg.role,
        content: msg.content,
        parts: msg.parts || [{ type: 'text', text: msg.content }]
      })));
    }
    
    return messages;
  }, [agent?.instructions, historyMessages]);

  // チャット機能の実装
  const { 
    messages,
    data: _data,
    addToolResult,
    append,
    stop,
  } = useChat({
    api: 'https://mcp-router.net/api/agent/chat/use',
    body: {
      agentId: getServerAgentId(agent) || agentId || '',
      tools: getEnabledTools,
    },
    headers: authToken ? {
      'Authorization': `Bearer ${authToken}`
    } : undefined, // Continue without auth headers if no token
    initialMessages,
    onToolCall: async ({toolCall}) => {
      if (agent?.autoExecuteTool) {
        // 自動実行が有効な場合、ツールを即座に実行
        try {
          const result = await window.electronAPI.executeAgentTool(agent.id, toolCall.toolName, toolCall.args);
          
          if (result.success) {
            addToolResult({
              toolCallId: toolCall.toolCallId,
              result: result.result
            });
          } else {
            addToolResult({
              toolCallId: toolCall.toolCallId,
              result: { error: result.error || 'Tool execution failed' }
            });
          }
        } catch (error) {
          addToolResult({
            toolCallId: toolCall.toolCallId,
            result: { error: error.message || 'Auto tool execution failed' }
          });
        }
      }
      // 手動実行の場合は、今は何もしない（将来的にUIに通知を送る）
    },
    onFinish: async (_message, { finishReason }) => {      
      // ストリーム終了をメインプロセスに送信
      if (window.electronAPI?.sendChatStreamEnd) {
        window.electronAPI.sendChatStreamEnd({
          backgroundSessionKey,
          chatHistorySessionId,
          agentId,
          finishReason,
          timestamp: Date.now(),
          canContinue: finishReason === 'stop'
        });
      }
      
      // セッション保存フラグを設定（実際の保存はuseEffectで行う）
      if (finishReason === 'stop') {
        setShouldSaveSession(true);
      }
    },
    onError: (error) => {
      // ストリームエラーをメインプロセスに送信
      if (window.electronAPI?.sendChatStreamError) {
        window.electronAPI.sendChatStreamError({
          backgroundSessionKey,
          chatHistorySessionId,
          agentId,
          error: error.message || error.toString(),
          timestamp: Date.now()
        });
      }
      
      // エラー発生時はセッションから削除
      if (onSessionComplete) {
        onSessionComplete(backgroundSessionKey);
      }
    }
  });

  // Track if query has been processed to avoid infinite loops
  const processedQueryRef = useRef<string>('');

  // Background chat stop handler
  useEffect(() => {
    const handleBackgroundChatStop = (stopData: { agentId: string }) => {
      if (stopData.agentId === agentId) {
        console.log('Stopping background chat for agent:', agentId);
        stop();
        
        // Also send stream end notification to main window
        if (window.electronAPI?.sendChatStreamEnd) {
          window.electronAPI.sendChatStreamEnd({
            backgroundSessionKey,
            chatHistorySessionId,
            agentId,
            finishReason: 'stop',
            timestamp: Date.now(),
            canContinue: false
          });
        }
        
        // Clean up the session
        if (onSessionComplete) {
          onSessionComplete(backgroundSessionKey);
        }
      }
    };

    window.electronAPI?.onBackgroundChatStop?.(handleBackgroundChatStop);
    
    return () => {
      // Cleanup listener if needed
    };
  }, [agentId, stop, backgroundSessionKey, chatHistorySessionId, onSessionComplete]);

  // queryが変更された時にメッセージを送信（一度だけ）
  useEffect(() => {
    if (query && query.trim() && isInitialized && query !== processedQueryRef.current) {
      processedQueryRef.current = query;
      
      // ストリーム開始をメインプロセスに送信
      if (window.electronAPI?.sendChatStreamStart) {
        window.electronAPI.sendChatStreamStart({
          backgroundSessionKey,
          chatHistorySessionId,
          agentId,
          query,
          timestamp: Date.now()
        });
      }
      
      // 新しいメッセージを送信（履歴はinitialMessagesで設定済み）
      try {
        append({
          role: 'user',
          content: query
        });
      } catch (error) {
        // エラーをメインプロセスに送信
        if (window.electronAPI?.sendChatStreamError) {
          window.electronAPI.sendChatStreamError({
            backgroundSessionKey,
            chatHistorySessionId,
            agentId,
            error: error.message || error.toString(),
            timestamp: Date.now()
          });
        }
        
        // エラー発生時はセッションから削除
        if (onSessionComplete) {
          onSessionComplete(backgroundSessionKey);
        }
      }
    }
  }, [query, isInitialized]); // Remove append from dependencies to avoid infinite loop

  // 初期化フラグをセット
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  // ローカルセッション保存処理
  useEffect(() => {
    const saveSession = async () => {
      if (shouldSaveSession && messages.length > 1) {
        try {
          if (!chatHistorySessionId) {
            // 新しいセッションを作成
            const session = await window.electronAPI.createSession(
              getServerAgentId(agent) || agentId,
              messages
            );
            console.log('Created new local session:', session.id);
          } else {
            // 既存セッションのメッセージを更新
            await window.electronAPI.updateSessionMessages(
              chatHistorySessionId,
              messages
            );
            console.log('Updated local session messages:', chatHistorySessionId);
          }
          
          // 保存完了後、フラグをリセット
          setShouldSaveSession(false);
          
          // セッション完了を通知してメモリ解放
          if (onSessionComplete) {
            onSessionComplete(backgroundSessionKey);
          }
        } catch (error) {
          console.error('Local session save failed:', error);
          setShouldSaveSession(false);
          
          // セッション保存エラーもメインプロセスに送信
          if (window.electronAPI?.sendChatStreamError) {
            window.electronAPI.sendChatStreamError({
              backgroundSessionKey,
              chatHistorySessionId,
              agentId,
              error: `Session save failed: ${error.message || error.toString()}`,
              timestamp: Date.now()
            });
          }
          
          // エラー発生時はセッションから削除
          if (onSessionComplete) {
            onSessionComplete(backgroundSessionKey);
          }
        }
      } else if (shouldSaveSession) {
        setShouldSaveSession(false);
      }
    };

    saveSession();
  }, [shouldSaveSession, messages, chatHistorySessionId, agent.id]);

  // メッセージの変更を監視してストリームチャンクを送信
  const previousMessagesRef = useRef<Message[]>([]);
  const streamedMessagesRef = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    // メッセージが追加または更新された場合のストリーミング処理
    messages.forEach((message, index) => {
      // アシスタントメッセージのうち、実際のコンテンツを持つもの処理
      // ツール呼び出しがあってもコンテンツがある場合は処理する
      if (message.role === 'assistant' && message.content && 
          message.content.trim() !== '' && 
          (!message.parts || !message.parts.some(part => part.type === 'tool-invocation'))) { // ツール呼び出しがないメッセージのみ
        
        const previousMessage = previousMessagesRef.current[index];
        
        // 新しいメッセージまたは内容が更新されたメッセージを検出
        if (!previousMessage || previousMessage.content !== message.content) {
          // メッセージIDと内容のハッシュを作成して重複を防ぐ
          const messageHash = `${message.id}-${message.content?.length || 0}`;
          
          if (!streamedMessagesRef.current.has(messageHash)) {
            // console.log('Streaming assistant message update:', {
            //   messageId: message.id,
            //   messageHash,
            //   content: message.content?.substring(0, 100) + (message.content?.length > 100 ? '...' : ''),
            //   isNew: !previousMessage,
            //   contentChanged: previousMessage?.content !== message.content,
            //   hasToolInvocations: !!message.parts?.some(part => part.type === 'tool-invocation')
            // });
            
            // ストリームチャンクを送信
            if (window.electronAPI?.sendChatStreamChunk) {
              window.electronAPI.sendChatStreamChunk({
                backgroundSessionKey,
                chatHistorySessionId,
                agentId,
                chunk: message.content,
                messageId: message.id,
                timestamp: Date.now()
              });
              
              // 送信済みメッセージとして記録
              streamedMessagesRef.current.add(messageHash);
            }
          }
        }
      }
      
      // ツール呼び出しを含むメッセージの処理
      const hasToolInvocations = message.role === 'assistant' && 
                                message.parts && 
                                message.parts.some(part => part.type === 'tool-invocation');
      
      if (hasToolInvocations) {
        // console.log('Message with tool invocations detected:', {
        //   messageId: message.id,
        //   content: message.content || '(no content)',
        //   hasContent: !!message.content,
        //   parts: message.parts,
        //   partsTypes: message.parts?.map(p => p.type)
        // });
        
        // ツール呼び出しメッセージの重複チェック
        const previousMessage = previousMessagesRef.current[index];
        const messageChanged = !previousMessage || 
                              JSON.stringify(previousMessage.parts) !== JSON.stringify(message.parts);
        
        if (messageChanged) {
          if (window.electronAPI?.sendChatStreamChunk) {
            window.electronAPI.sendChatStreamChunk({
              backgroundSessionKey,
              chatHistorySessionId,
              agentId,
              chunk: message.content || '',
              messageId: message.id,
              timestamp: Date.now(),
              isToolInvocation: true,
              completeMessage: message, // 完全なメッセージを送信
              isCompleteMessage: true
            });
          }
        }
      }
    });
    
    previousMessagesRef.current = [...messages];
  }, [messages, backgroundSessionKey, chatHistorySessionId, agentId]);

  // デバッグ用ログ
  // useEffect(() => {
  //   console.log('BackgroundComponent props changed:', {
  //     chatHistorySessionId,
  //     agentId,
  //     query,
  //     hasAuthToken: !!authToken,
  //     messagesCount: messages.length,
  //     isInitialized,
  //     currentInput: input,
  //     errorState: error
  //   });
  // }, [chatHistorySessionId, agentId, query, authToken, messages.length, isInitialized, input, error]);

  // このコンポーネントは表示されないが、デバッグ時に状態を確認できるよう
  // 簡単なdivを返す
  return (
    <div>
      <div>Background Chat Component</div>
      <div>Agent ID: {agentId}</div>
      <div>Chat History Session ID: {chatHistorySessionId}</div>
      <div>Query: {query}</div>
      <div>Messages: {messages.length}</div>
    </div>
  );
};

export default BackgroundComponent;