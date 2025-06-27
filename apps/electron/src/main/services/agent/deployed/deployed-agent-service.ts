import {
  DeployedAgent as DeployedAgentType,
  MCPTool,
} from "@mcp-router/shared";
import { getDeployedAgentRepository } from "../../../../lib/database";
import { DeployedAgent } from "./deployed-agent";
import { logError, logInfo } from "../../../../lib/utils/backend/error-handler";
import { SingletonService } from "../../singleton-service";

/**
 * デプロイ済みエージェント管理サービス（軽量版）
 * 読み取り専用の操作とツール実行のみを担当
 */
class DeployedAgentService extends SingletonService<
  DeployedAgentType,
  string,
  DeployedAgentService
> {
  private agents: Map<string, DeployedAgent> = new Map();

  /**
   * コンストラクタ
   */
  protected constructor() {
    super();
    this.loadAgents();
  }

  /**
   * エンティティ名を取得
   */
  protected getEntityName(): string {
    return "Deployed Agent";
  }

  /**
   * シングルトンインスタンスを取得する静的メソッド
   */
  public static getInstance(): DeployedAgentService {
    return this.getInstanceBase();
  }

  /**
   * Reset instance (used when switching workspaces)
   */
  public static resetInstance(): void {
    this.resetInstanceBase(DeployedAgentService);
  }

  /**
   * エージェント情報を読み込む
   */
  private loadAgents(): void {
    try {
      const agents = getDeployedAgentRepository().getAllDeployedAgents();

      for (const agent of agents) {
        this.agents.set(agent.id, new DeployedAgent(agent));
      }

      logInfo(
        `${this.agents.size}個のデプロイ済みエージェント情報を読み込みました`,
      );
    } catch (error) {
      logError(
        "デプロイ済みエージェント情報の読み込み中にエラーが発生しました",
        error,
      );
    }
  }

  /**
   * エージェントインスタンスを取得する（必要に応じて作成）
   */
  private getAgentInstance(id: string): DeployedAgent | undefined {
    if (this.agents.has(id)) {
      return this.agents.get(id);
    }

    const agentConfig = getDeployedAgentRepository().getDeployedAgentById(id);
    if (!agentConfig) {
      return undefined;
    }

    const agent = new DeployedAgent(agentConfig);
    this.agents.set(id, agent);

    return agent;
  }

  /**
   * 全てのデプロイ済みエージェントを取得する
   */
  public getDeployedAgents(): DeployedAgentType[] {
    try {
      return getDeployedAgentRepository().getAllDeployedAgents();
    } catch (error) {
      logError("デプロイ済みエージェントの取得中にエラーが発生しました", error);
      return [];
    }
  }

  /**
   * 指定されたIDのデプロイ済みエージェントを取得する
   */
  public getDeployedAgentById(id: string): DeployedAgentType | undefined {
    try {
      return getDeployedAgentRepository().getDeployedAgentById(id);
    } catch (error) {
      logError(
        `ID: ${id} のデプロイ済みエージェントの取得中にエラーが発生しました`,
        error,
      );
      return undefined;
    }
  }

  /**
   * デプロイ済みエージェントを更新する
   * MCPサーバーの変更とツール権限の同期を統一的に処理
   */
  public async updateDeployedAgent(
    id: string,
    updates: Partial<DeployedAgentType>,
  ): Promise<DeployedAgentType | undefined> {
    try {
      const agentInstance = this.getAgentInstance(id);
      if (!agentInstance) {
        throw new Error(`デプロイ済みエージェントが見つかりません (ID: ${id})`);
      }

      // エージェントインスタンスの設定を更新（ツール権限同期も含む）
      const updatedConfig = await agentInstance.updateConfig(updates, true);

      // データベースに保存
      const result = getDeployedAgentRepository().updateDeployedAgent(id, {
        ...updatedConfig,
        updatedAt: Date.now(),
      });

      if (result) {
        logInfo(
          `デプロイ済みエージェント "${result.name}" の設定が更新されました (ID: ${id})`,
        );
      }

      return result;
    } catch (error) {
      logError(
        `ID: ${id} のデプロイ済みエージェントの設定更新中にエラーが発生しました`,
        error,
      );
      throw error;
    }
  }

  /**
   * デプロイ済みエージェントを削除する
   */
  public deleteDeployedAgent(id: string): boolean {
    try {
      const agentInstance = this.getAgentInstance(id);
      if (agentInstance) {
        // 接続を閉じる
        agentInstance.closeConnections();
        this.agents.delete(id);
      }

      const result = getDeployedAgentRepository().deleteDeployedAgent(id);

      if (result) {
        logInfo(`デプロイ済みエージェントが削除されました (ID: ${id})`);
      }

      return result;
    } catch (error) {
      logError(
        `ID: ${id} のデプロイ済みエージェントの削除中にエラーが発生しました`,
        error,
      );
      return false;
    }
  }

  /**
   * デプロイ済みエージェントの利用可能なツールを取得する
   */
  public async getAvailableTools(
    id: string,
  ): Promise<Record<string, MCPTool[]>> {
    try {
      const agentInstance = this.getAgentInstance(id);
      if (!agentInstance) {
        throw new Error(`デプロイ済みエージェントが見つかりません (ID: ${id})`);
      }

      return await agentInstance.getAvailableTools();
    } catch (error) {
      logError(
        `デプロイ済みエージェント (ID: ${id}) の利用可能ツール取得中にエラーが発生しました`,
        error,
      );
      return {};
    }
  }

  /**
   * 特定のMCPサーバーのツールを取得する
   */
  public async getAgentMCPServerTools(
    agentId: string,
    serverId: string,
  ): Promise<(MCPTool & { enabled?: boolean })[]> {
    const agentInstance = this.getAgentInstance(agentId);
    if (!agentInstance) {
      throw new Error(
        `デプロイ済みエージェントが見つかりません (ID: ${agentId})`,
      );
    }

    // Let the exception propagate to the handler
    return await agentInstance.getMCPServerTools(serverId);
  }

  /**
   * MCPツールを呼び出す
   */
  public async callAgentTool(
    agentId: string,
    toolName: string,
    args: Record<string, any>,
  ): Promise<any> {
    try {
      const agentInstance = this.getAgentInstance(agentId);
      if (!agentInstance) {
        throw new Error(
          `デプロイ済みエージェントが見つかりません (ID: ${agentId})`,
        );
      }

      return await agentInstance.callTool(toolName, args);
    } catch (error) {
      logError(
        `デプロイ済みエージェント (ID: ${agentId}) のツール呼び出し中にエラーが発生しました`,
        error,
      );
      throw error;
    }
  }

  /**
   * エージェントのサーバー接続状態を取得する
   */
  public getAgentServerStatuses(
    id: string,
  ): Record<string, "running" | "stopped" | "error"> | undefined {
    try {
      const agentInstance = this.getAgentInstance(id);
      if (!agentInstance) {
        return undefined;
      }

      return agentInstance.getAllServerStatuses();
    } catch (error) {
      logError(
        `デプロイ済みエージェント (ID: ${id}) のサーバー状態取得中にエラーが発生しました`,
        error,
      );
      return undefined;
    }
  }

  /**
   * 特定のサーバーの接続状態を取得する
   */
  public getAgentServerStatus(
    agentId: string,
    serverId: string,
  ): "running" | "stopped" | "error" | undefined {
    try {
      const agentInstance = this.getAgentInstance(agentId);
      if (!agentInstance) {
        return undefined;
      }

      return agentInstance.getServerStatus(serverId);
    } catch (error) {
      logError(
        `デプロイ済みエージェント (ID: ${agentId}) のサーバー (ID: ${serverId}) 状態取得中にエラーが発生しました`,
        error,
      );
      return undefined;
    }
  }

  /**
   * エージェントの接続を閉じる
   */
  public closeAgentConnections(id: string): boolean {
    try {
      const agentInstance = this.getAgentInstance(id);
      if (!agentInstance) {
        return false;
      }

      agentInstance.closeConnections();
      logInfo(`デプロイ済みエージェント (ID: ${id}) の接続を閉じました`);
      return true;
    } catch (error) {
      logError(
        `デプロイ済みエージェント (ID: ${id}) の接続切断中にエラーが発生しました`,
        error,
      );
      return false;
    }
  }

  /**
   * 全てのエージェントの接続を閉じる
   */
  public closeAllConnections(): void {
    try {
      for (const [agentId, agent] of this.agents) {
        try {
          agent.closeConnections();
        } catch (error) {
          logError(
            `デプロイ済みエージェント (ID: ${agentId}) の接続切断中にエラーが発生しました`,
            error,
          );
        }
      }

      logInfo("全てのデプロイ済みエージェントの接続を閉じました");
    } catch (error) {
      logError(
        "デプロイ済みエージェントの一括接続切断中にエラーが発生しました",
        error,
      );
    }
  }

  /**
   * 新しいデプロイ済みエージェントを作成する（インポート用）
   */
  public createDeployedAgent(
    agentData: Omit<DeployedAgentType, "id" | "createdAt" | "updatedAt">,
  ): DeployedAgentType {
    try {
      const deployedAgent =
        getDeployedAgentRepository().createDeployedAgent(agentData);

      // エージェントインスタンスを作成してキャッシュ
      this.agents.set(deployedAgent.id, new DeployedAgent(deployedAgent));

      logInfo(
        `新しいデプロイ済みエージェント "${deployedAgent.name}" が作成されました (ID: ${deployedAgent.id})`,
      );

      return deployedAgent;
    } catch (error) {
      logError("デプロイ済みエージェントの作成中にエラーが発生しました", error);
      throw error;
    }
  }

  /**
   * 開発中エージェントからデプロイ済みエージェントを作成する
   */
  public deployFromDevelopmentAgent(sourceAgent: any): DeployedAgentType {
    try {
      const deployedAgent =
        getDeployedAgentRepository().deployFromAgent(sourceAgent);

      // エージェントインスタンスを作成してキャッシュ
      this.agents.set(deployedAgent.id, new DeployedAgent(deployedAgent));

      logInfo(
        `エージェント "${sourceAgent.name}" がデプロイされました (ID: ${deployedAgent.id})`,
      );

      return deployedAgent;
    } catch (error) {
      logError(
        `エージェント "${sourceAgent.name}" のデプロイ中にエラーが発生しました`,
        error,
      );
      throw error;
    }
  }

  /**
   * 統計情報を取得する
   */
  public getStatistics(): {
    totalAgents: number;
    activeConnections: number;
    errorConnections: number;
  } {
    try {
      const totalAgents = this.agents.size;
      let activeConnections = 0;
      let errorConnections = 0;

      for (const agent of this.agents.values()) {
        const statuses = agent.getAllServerStatuses();
        for (const status of Object.values(statuses)) {
          if (status === "running") {
            activeConnections++;
          } else if (status === "error") {
            errorConnections++;
          }
        }
      }

      return {
        totalAgents,
        activeConnections,
        errorConnections,
      };
    } catch (error) {
      logError(
        "デプロイ済みエージェントの統計情報取得中にエラーが発生しました",
        error,
      );
      return {
        totalAgents: 0,
        activeConnections: 0,
        errorConnections: 0,
      };
    }
  }
}

export { DeployedAgentService };
