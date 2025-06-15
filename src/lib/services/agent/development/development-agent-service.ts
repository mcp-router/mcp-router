import { AgentConfig, MCPServerConfig, MCPTool, MCPAgentToolPermission } from '../../../../types';
import { getAgentRepository } from '../../../database/agent-repository';
import { getServerService } from '../../server-service';
import { DevelopmentAgent } from './development-agent';
import { v4 as uuidv4 } from 'uuid';
import { logError, logInfo } from '../../../utils/error-handler';
import { Singleton } from '../../../utils/singleton';

/**
 * 開発中エージェント管理サービス
 * 開発中のエージェントのCRUD操作とMCPサーバー管理を担当
 */
class DevelopmentAgentService extends Singleton<DevelopmentAgentService> {
  private agents: Map<string, DevelopmentAgent> = new Map();
  private repository = getAgentRepository();

  /**
   * シングルトンインスタンスを取得する静的メソッド
   */
  public static getInstance(): DevelopmentAgentService {
    return this.getInstanceBase();
  }

  constructor() {
    super();
    this.loadAgents();
  }

  /**
   * エージェント情報を読み込む
   */
  private loadAgents(): void {
    try {
      const agents = this.repository.getAllAgents();

      for (const agent of agents) {
        this.agents.set(agent.id, new DevelopmentAgent(agent));
      }

      logInfo(`${this.agents.size}個の開発中エージェント情報を読み込みました`);
    } catch (error) {
      logError('開発中エージェント情報の読み込み中にエラーが発生しました', error);
    }
  }

  /**
   * エージェントインスタンスを取得する（必要に応じて作成）
   */
  private getAgentInstance(id: string): DevelopmentAgent | undefined {
    if (this.agents.has(id)) {
      return this.agents.get(id);
    }

    const agentConfig = this.repository.getAgentById(id);
    if (!agentConfig) {
      return undefined;
    }

    const agent = new DevelopmentAgent(agentConfig);
    this.agents.set(id, agent);

    return agent;
  }

  /**
   * 全ての開発中エージェントを取得する
   */
  public getAgents(): AgentConfig[] {
    try {
      return this.repository.getAllAgents();
    } catch (error) {
      logError('開発中エージェントの取得中にエラーが発生しました', error);
      return [];
    }
  }

  /**
   * 指定されたIDの開発中エージェントを取得する
   */
  public getAgentById(id: string): AgentConfig | undefined {
    try {
      return this.repository.getAgentById(id);
    } catch (error) {
      logError(`ID: ${id} の開発中エージェントの取得中にエラーが発生しました`, error);
      return undefined;
    }
  }

  /**
   * サーバIDから完全なサーバ設定をコピーする
   */
  private copyServerConfigs(serverIds: string[]): MCPServerConfig[] {
    try {
      const serverService = getServerService();
      const serverConfigs: MCPServerConfig[] = [];

      for (const serverId of serverIds) {
        const server = serverService.getServerById(serverId);
        if (server) {
          const configCopy: MCPServerConfig = {
            ...server,
            id: uuidv4()
          };

          serverConfigs.push(configCopy);
        }
      }

      return serverConfigs;
    } catch (error) {
      logError('サーバ設定のコピー中にエラーが発生しました', error);
      return [];
    }
  }

  /**
   * 新しい開発中エージェントを作成する
   */
  public createAgent(agentConfig: Omit<AgentConfig, 'id'>): AgentConfig {
    try {
      let mcpServersConfig: MCPServerConfig[] = [];

      if (Array.isArray(agentConfig.mcpServers)) {
        if (typeof agentConfig.mcpServers[0] === 'string') {
          mcpServersConfig = this.copyServerConfigs(agentConfig.mcpServers as unknown as string[]);
        } else {
          mcpServersConfig = agentConfig.mcpServers as MCPServerConfig[];
        }
      }

      const config: AgentConfig = {
        ...agentConfig,
        mcpServers: mcpServersConfig,
        id: uuidv4()
      };

      const agent = this.repository.addAgent(config);

      // エージェントインスタンスを作成してキャッシュ
      this.agents.set(agent.id, new DevelopmentAgent(agent));

      logInfo(`新しい開発中エージェント "${agent.name}" が作成されました (ID: ${agent.id})`);

      return agent;
    } catch (error) {
      logError('開発中エージェントの作成中にエラーが発生しました', error);
      throw error;
    }
  }

  /**
   * 開発中エージェントを更新する
   */
  public async updateAgent(id: string, config: Partial<AgentConfig>): Promise<AgentConfig | undefined> {
    try {
      const currentAgent = this.repository.getAgentById(id);

      if (!currentAgent) {
        logError(`更新対象の開発中エージェントが見つかりません (ID: ${id})`);
        return undefined;
      }

      const agentInstance = this.getAgentInstance(id);
      if (agentInstance) {
        logInfo(`開発中エージェント "${currentAgent.name}" (ID: ${id}) の設定を更新します`);

        await agentInstance.updateConfig(config, true);
        const updatedConfig = agentInstance.getConfig();

        const updatedAgent = this.repository.updateAgent(id, updatedConfig);

        logInfo(`開発中エージェント "${updatedAgent.name}" (ID: ${id}) が正常に更新されました`);
        return updatedAgent;
      }

      logInfo(`開発中エージェント "${currentAgent.name}" (ID: ${id}) のインスタンスを作成して更新します`);
      const newAgentInstance = new DevelopmentAgent(currentAgent);
      this.agents.set(id, newAgentInstance);

      await newAgentInstance.updateConfig(config, true);
      const updatedConfig = newAgentInstance.getConfig();

      const updatedAgent = this.repository.updateAgent(id, updatedConfig);

      logInfo(`開発中エージェント "${updatedAgent.name}" (ID: ${id}) が正常に更新されました (新規インスタンス)`);
      return updatedAgent;
    } catch (error) {
      logError(`ID: ${id} の開発中エージェントの更新中にエラーが発生しました`, error);
      throw error;
    }
  }

  /**
   * 開発中エージェントを削除する
   */
  public deleteAgent(id: string): boolean {
    try {
      const agentInstance = this.getAgentInstance(id);
      if (agentInstance) {
        agentInstance.stopServers();
        this.agents.delete(id);
      }

      const result = this.repository.deleteAgent(id);

      if (result) {
        logInfo(`開発中エージェントが削除されました (ID: ${id})`);
      }

      return result;
    } catch (error) {
      logError(`ID: ${id} の開発中エージェントの削除中にエラーが発生しました`, error);
      return false;
    }
  }

  /**
   * 特定のMCPサーバーのツールを取得する
   */
  public async getAgentMCPServerTools(agentId: string, serverId: string): Promise<(MCPTool & { enabled?: boolean })[]> {
    const agentInstance = this.getAgentInstance(agentId);
    if (!agentInstance) {
      throw new Error(`開発中エージェントが見つかりません (ID: ${agentId})`);
    }

    // Let the exception propagate to the handler
    const tools = await agentInstance.getMCPServerTools(serverId);
    return tools;
  }

  /**
   * MCPツールを呼び出す
   */
  public async callAgentTool(
    agentId: string,
    toolName: string,
    args: Record<string, any>
  ): Promise<any> {
    try {
      const agentInstance = this.getAgentInstance(agentId);
      if (!agentInstance) {
        throw new Error(`開発中エージェントが見つかりません (ID: ${agentId})`);
      }

      return await agentInstance.callTool(toolName, args);
    } catch (error) {
      logError(`開発中エージェント (ID: ${agentId}) のツール呼び出し中にエラーが発生しました`, error);
      throw error;
    }
  }

  /**
   * サーバーからリソース一覧を取得する
   */
  public async getAgentServerResources(agentId: string, serverId: string): Promise<any[]> {
    const agentInstance = this.getAgentInstance(agentId);
    if (!agentInstance) {
      return [];
    }

    try {
      return await agentInstance.getServerResources(serverId);
    } catch (error) {
      logError(`開発中エージェント (ID: ${agentId}) のサーバー (ID: ${serverId}) からのリソース取得中にエラーが発生しました`, error);
      return [];
    }
  }

  /**
   * サーバーからリソースを読み込む
   */
  public async readAgentServerResource(agentId: string, serverId: string, uri: string): Promise<any> {
    const agentInstance = this.getAgentInstance(agentId);
    if (!agentInstance) {
      throw new Error(`開発中エージェント (ID: ${agentId}) が見つかりません`);
    }

    try {
      return await agentInstance.readServerResource(serverId, uri);
    } catch (error) {
      logError(`開発中エージェント (ID: ${agentId}) のサーバー (ID: ${serverId}) からのリソース読み込み中にエラーが発生しました`, error);
      throw error;
    }
  }

  /**
   * セットアップ完了状態を更新する
   */
  public completeSetup(id: string, completed: boolean, updatedServers?: MCPServerConfig[]): AgentConfig | undefined {
    try {
      const agent = this.repository.getAgentById(id);
      if (!agent) {
        return undefined;
      }

      const updates: Partial<AgentConfig> = {};

      if (updatedServers) {
        updates.mcpServers = updatedServers;

        const agentInstance = this.getAgentInstance(id);
        if (agentInstance) {
          agentInstance.updateConfig(updates);
        }
      }

      const updatedAgent = this.repository.updateAgent(id, updates);

      if (updatedAgent) {
        logInfo(`開発中エージェント "${updatedAgent.name}" のセットアップ状態が ${completed ? '完了' : '未完了'} に更新されました (ID: ${id})`);
      }

      return updatedAgent;
    } catch (error) {
      logError(`ID: ${id} の開発中エージェントのセットアップ状態更新中にエラーが発生しました`, error);
      return undefined;
    }
  }

  /**
   * 開発中エージェントのための初期化処理
   */
  public async initializeAgent(id: string, syncToolPermissions = true): Promise<boolean> {
    try {
      const agentInstance = this.getAgentInstance(id);
      if (!agentInstance) {
        return false;
      }

      await agentInstance.init(syncToolPermissions);
      return true;
    } catch (error) {
      logError(`開発中エージェント (ID: ${id}) の初期化中にエラーが発生しました`, error);
      return false;
    }
  }

  /**
   * 開発中エージェントのMCPサーバーを開始する
   */
  public async startAgentServers(id: string): Promise<boolean> {
    try {
      const agentInstance = this.getAgentInstance(id);
      if (!agentInstance) {
        return false;
      }

      return await agentInstance.startServers();
    } catch (error) {
      logError(`開発中エージェント (ID: ${id}) のMCPサーバー開始中にエラーが発生しました`, error);
      return false;
    }
  }

  /**
   * 開発中エージェントのMCPサーバーを停止する
   */
  public stopAgentServers(id: string): boolean {
    try {
      const agentInstance = this.getAgentInstance(id);
      if (!agentInstance) {
        return false;
      }

      return agentInstance.stopServers();
    } catch (error) {
      logError(`開発中エージェント (ID: ${id}) のMCPサーバー停止中にエラーが発生しました`, error);
      return false;
    }
  }
}

export { DevelopmentAgentService };
