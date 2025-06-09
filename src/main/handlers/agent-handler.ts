import { ipcMain } from 'electron';
import { AgentConfig } from '../../types';
import { 
  getDevelopmentAgentService, 
  getDeployedAgentService, 
  getAgentSharingService,
} from '../../lib/services/agent';
import { backgroundWindow, mainWindow } from '../../main';
import { status } from '../auth';
import { getSessionRepository } from '../../lib/database/session-repository';

/**
 * エージェント関連のIPC通信ハンドラをセットアップ
 */
export function setupAgentHandlers(): void {
  const developmentAgentService = getDevelopmentAgentService();
  const deployedAgentService = getDeployedAgentService();
  const agentSharingService = getAgentSharingService();
  const sessionRepository = getSessionRepository();
  // 開発中エージェント基本操作のIPC通信ハンドラ
  ipcMain.handle('agent:list', () => {
    return developmentAgentService.getAgents();
  });

  ipcMain.handle('agent:get', (_, id: string) => {
    return developmentAgentService.getAgentById(id);
  });

  ipcMain.handle('agent:create', (_, agentConfig: Omit<AgentConfig, 'id'>) => {
    return developmentAgentService.createAgent(agentConfig);
  });

  ipcMain.handle('agent:update', (_, id: string, config: Partial<AgentConfig>) => {
    return developmentAgentService.updateAgent(id, config);
  });

  ipcMain.handle('agent:delete', (_, id: string) => {
    return developmentAgentService.deleteAgent(id);
  });

  // 共有関連のIPC通信ハンドラ
  ipcMain.handle('agent:share', async (_, id: string) => {
    const agent = developmentAgentService.getAgentById(id);
    if (!agent) {
      throw new Error(`エージェントが見つかりません (ID: ${id})`);
    }
    return agentSharingService.shareAgent(agent);
  });

  ipcMain.handle('agent:import', async (_, shareCode: string) => {
    const sharedData = await agentSharingService.getSharedAgentData(shareCode);
    const deployedAgentData = agentSharingService.convertToDeployedAgent(sharedData);
    return deployedAgentService.createDeployedAgent(deployedAgentData);
  });

  // エージェントのセットアップ関連のIPC通信ハンドラ
  ipcMain.handle('agent:complete-setup', (_, id: string, completed: boolean, updatedServers?: any[]) => {
    return developmentAgentService.completeSetup(id, completed, updatedServers);
  });

  // エージェントデプロイ関連のIPC通信ハンドラ
  ipcMain.handle('agent:deploy', (_, id: string) => {
    const developmentAgent = developmentAgentService.getAgentById(id);
    if (!developmentAgent) {
      throw new Error(`開発中エージェントが見つかりません (ID: ${id})`);
    }
    return deployedAgentService.deployFromDevelopmentAgent(developmentAgent);
  });

  ipcMain.handle('agent:deployed-list', () => {
    return deployedAgentService.getDeployedAgents();
  });

  ipcMain.handle('agent:deployed-get', (_, id: string) => {
    return deployedAgentService.getDeployedAgentById(id);
  });

  ipcMain.handle('agent:deployed-update', (_, id: string, config: any) => {
    return deployedAgentService.updateDeployedAgent(id, config);
  });

  ipcMain.handle('agent:deployed-delete', (_, id: string) => {
    return deployedAgentService.deleteDeployedAgent(id);
  });

  // エージェント固有のツール関連のIPC通信ハンドラ（共有版）
  ipcMain.handle('agent:get-server-tools', async (_, id: string, isDev = false) => {
    try {
      // まずデプロイ済みエージェントを確認
      const deployedAgent = deployedAgentService.getDeployedAgentById(id);
      
      if (deployedAgent && !isDev) {
        // デプロイ済みエージェントの場合
        const tools = await deployedAgentService.getAgentServerTools(id);
        return { success: true, tools };
      } else {
        // 開発中エージェントの場合
        const tools = await developmentAgentService.getAgentServerTools(id);
        return { success: true, tools };
      }
    } catch (error) {
      console.error('エージェント固有のツール取得中にエラーが発生しました:', error);
      return { success: false, error: error.message, tools: {} };
    }
  });

  // エージェントツール実行のIPC通信ハンドラ
  ipcMain.handle('agent:execute-tools', async (_, agentId: string, toolName: string, args: Record<string, any>) => {
    try {
      // まずデプロイ済みエージェントを確認
      const deployedAgent = deployedAgentService.getDeployedAgentById(agentId);
      
      if (deployedAgent) {
        // デプロイ済みエージェントの場合
        const result = await deployedAgentService.callAgentTool(agentId, toolName, args);
        return { 
          success: true, 
          result
        };
      } else {
        // 開発中エージェントの場合
        const result = await developmentAgentService.callAgentTool(agentId, toolName, args);
        return { 
          success: true, 
          result
        };
      }
    } catch (error) {
      console.error(`エージェント (ID: ${agentId}) でツール実行中にエラーが発生しました:`, error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  });

  // バックグラウンドチャット関連のIPC通信ハンドラ
  ipcMain.handle('agent:background-chat-start', async (_, sessionId: string | undefined, agentId: string, query: string) => {
    try {
      if (!backgroundWindow) {
        throw new Error('Background window not available');
      }

      // Get agent data
      const deployedAgent = deployedAgentService.getDeployedAgentById(agentId);
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
            console.log(`Loaded ${messages.length} messages from session ${sessionId}`);
          }
        } catch (error) {
          console.warn(`Failed to load session messages for ${sessionId}:`, error);
          // 履歴読み込みに失敗しても続行
        }
      }

      // Send message to background window to start chat
      backgroundWindow.webContents.send('background-chat:start', {
        sessionId,
        agentId,
        query,
        agent: deployedAgent,
        authToken,
        messages // 履歴も含めて送信
      });

      return { success: true };
    } catch (error) {
      console.error(`Background chat start failed for agent (ID: ${agentId}):`, error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  });

  // バックグラウンドチャット停止のIPC通信ハンドラ
  ipcMain.handle('agent:background-chat-stop', async (_, agentId: string) => {
    try {
      if (!backgroundWindow) {
        throw new Error('Background window not available');
      }

      // Send stop message to background window
      backgroundWindow.webContents.send('background-chat:stop', {
        agentId
      });

      return { success: true };
    } catch (error) {
      console.error(`Background chat stop failed for agent (ID: ${agentId}):`, error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  });

  // チャットストリーム関連のIPC通信ハンドラ
  ipcMain.handle('agent:chat-stream-start', async (_) => {
    try {
      return { success: true };
    } catch (error) {
      console.error('Chat stream start failed:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('agent:chat-stream-chunk', async (_, chunkData) => {
    try {
      // メインウィンドウにストリームチャンクを転送
      if (mainWindow) {
        mainWindow.webContents.send('chat-stream:chunk', chunkData);
      }
      return { success: true };
    } catch (error) {
      console.error('Chat stream chunk failed:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('agent:chat-stream-end', async (_, endData) => {
    try {
      // バックグラウンドウィンドウからのストリーム終了を受信
      // console.log('Chat stream ended:', endData);
      
      // メインウィンドウにストリーム終了を通知
      if (mainWindow) {
        mainWindow.webContents.send('chat-stream:end', endData);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Chat stream end failed:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('agent:chat-stream-error', async (_, errorData) => {
    try {
      // メインウィンドウにストリームエラーを通知
      if (mainWindow) {
        mainWindow.webContents.send('chat-stream:error', errorData);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Chat stream error handling failed:', error);
      return { success: false, error: error.message };
    }
  });

  // セッションメッセージ取得のIPC通信ハンドラ（ローカルDB使用）
  ipcMain.handle('agent:fetch-session-messages', async (_, sessionId: string) => {
    try {
      const session = sessionRepository.getById(sessionId);
      if (!session) {
        throw new Error(`Session not found (ID: ${sessionId})`);
      }
      return session.messages;
    } catch (error) {
      console.error(`Failed to fetch session messages for session (ID: ${sessionId}):`, error);
      throw error;
    }
  });

  // ローカルセッション管理のIPC通信ハンドラ
  ipcMain.handle('agent:get-sessions', async (_, agentId: string, options: any = {}) => {
    try {
      const result = sessionRepository.getSessionsByAgent(agentId, options);
      return result;
    } catch (error) {
      console.error(`Failed to get sessions for agent (ID: ${agentId}):`, error);
      throw error;
    }
  });

  ipcMain.handle('agent:create-session', async (_, agentId: string, initialMessages: any[] = [], title?: string) => {
    try {
      const session = sessionRepository.createSession(agentId, initialMessages, title);
      return session;
    } catch (error) {
      console.error(`Failed to create session for agent (ID: ${agentId}):`, error);
      throw error;
    }
  });

  ipcMain.handle('agent:update-session-messages', async (_, sessionId: string, messages: any[]) => {
    try {
      const session = sessionRepository.updateSessionMessages(sessionId, messages);
      if (!session) {
        throw new Error(`Session not found (ID: ${sessionId})`);
      }
      return session;
    } catch (error) {
      console.error(`Failed to update session messages (ID: ${sessionId}):`, error);
      throw error;
    }
  });

  ipcMain.handle('agent:delete-session', async (_, sessionId: string) => {
    try {
      const result = sessionRepository.delete(sessionId);
      return result;
    } catch (error) {
      console.error(`Failed to delete session (ID: ${sessionId}):`, error);
      throw error;
    }
  });
}