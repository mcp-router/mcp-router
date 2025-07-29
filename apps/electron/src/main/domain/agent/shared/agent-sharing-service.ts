import {
  AgentConfig,
  DeployedAgent as DeployedAgentType,
} from "@mcp_router/shared";
import { logError, logInfo } from "@/main/utils/logger";
import { fetchWithTokenJson } from "@/main/utils/fetch-utils";
import { SingletonService } from "@/main/application/core/singleton-service";

/**
 * エージェント共有サービス
 * オンライン共有・インポート機能と開発中/デプロイ済みエージェント間のブリッジ役
 */
class AgentSharingService extends SingletonService<
  any,
  string,
  AgentSharingService
> {
  /**
   * コンストラクタ
   */
  protected constructor() {
    super();
  }

  /**
   * エンティティ名を取得
   */
  protected getEntityName(): string {
    return "Agent Sharing";
  }

  /**
   * シングルトンインスタンスを取得する静的メソッド
   */
  public static getInstance(): AgentSharingService {
    return (this as any).getInstanceBase();
  }

  /**
   * Reset instance (used when switching workspaces)
   */
  public static resetInstance(): void {
    (this as any).resetInstanceBase(AgentSharingService);
  }

  /**
   * 開発中エージェントをオンラインで共有し、共有リンクを取得する
   */
  public async shareAgent(agent: AgentConfig): Promise<string> {
    try {
      // 共有可能な設定を作成（機密情報を除去）
      const shareableConfig = {
        name: agent.name,
        purpose: agent.purpose,
        description: agent.description,
        instructions: agent.instructions,
        mcpServers: agent.mcpServers.map((s) => {
          const { bearerToken, ...rest } = s;
          return {
            ...rest,
            env: s.env
              ? Object.fromEntries(Object.keys(s.env).map((key) => [key, ""]))
              : {},
          };
        }),
        toolPermissions: agent.toolPermissions,
      };

      // 共有リンクを取得
      const result = await fetchWithTokenJson<{ link: string }>(
        "/agent/share",
        {
          method: "POST",
          body: JSON.stringify(shareableConfig),
        },
      );

      logInfo(
        `エージェント "${agent.name}" の共有リンクが生成されました (ID: ${agent.id})`,
      );
      return result.link;
    } catch (error) {
      logError(
        `エージェント "${agent.name}" (ID: ${agent.id}) の共有中にエラーが発生しました`,
        error,
      );
      throw error;
    }
  }

  /**
   * 共有コードからエージェント情報を取得する
   */
  public async getSharedAgentData(shareUrl: string): Promise<any> {
    try {
      let agentId: string;

      // URLかどうかをチェック
      if (shareUrl.startsWith("http")) {
        // 共有URLからエージェント情報を取得
        agentId = shareUrl.split("/").pop() || "";
        if (!agentId) {
          throw new Error("無効な共有URLです");
        }
      } else {
        agentId = shareUrl;
      }

      // APIからエージェント情報を取得
      const agentData = await fetchWithTokenJson<any>(`/agent/${agentId}`, {
        method: "GET",
      });

      logInfo(`共有エージェント情報を取得しました (ID: ${agentId})`);
      return agentData;
    } catch (error) {
      logError("共有エージェント情報の取得中にエラーが発生しました", error);
      throw error;
    }
  }

  /**
   * エージェント設定をバリデーションする
   */
  public validateAgentConfig(config: any): void {
    if (!config.name || typeof config.name !== "string") {
      throw new Error("エージェント名は必須です");
    }

    if (!config.purpose || typeof config.purpose !== "string") {
      throw new Error("エージェントの目的は必須です");
    }

    if (!config.instructions || typeof config.instructions !== "string") {
      throw new Error("エージェントへの指示は必須です");
    }

    if (!Array.isArray(config.mcpServers)) {
      throw new Error("MCPサーバリストは配列である必要があります");
    }
  }

  /**
   * 共有エージェントデータをデプロイ済みエージェント形式に変換する
   */
  public convertToDeployedAgent(
    sharedData: any,
  ): Omit<DeployedAgentType, "id" | "createdAt" | "updatedAt"> {
    try {
      // バリデーション
      this.validateAgentConfig(sharedData);

      const now = Date.now();
      const deployedAgent: Omit<
        DeployedAgentType,
        "id" | "createdAt" | "updatedAt"
      > = {
        name: sharedData.name,
        description: sharedData.description || "",
        mcpServers: sharedData.mcpServers || [],
        purpose: sharedData.purpose,
        instructions: sharedData.instructions,
        autoExecuteTool: sharedData.autoExecuteTool ?? true,
        toolPermissions: sharedData.toolPermissions,
        userId: sharedData.userId,
        originalId: sharedData.id || "",
      };

      logInfo(
        `共有エージェント "${sharedData.name}" をデプロイ済みエージェント形式に変換しました`,
      );
      return deployedAgent;
    } catch (error) {
      logError("共有エージェントデータの変換中にエラーが発生しました", error);
      throw error;
    }
  }

  /**
   * 開発中エージェントからデプロイ済みエージェント形式に変換する
   */
  public convertDevelopmentToDeployed(
    developmentAgent: AgentConfig,
  ): Omit<DeployedAgentType, "id" | "createdAt" | "updatedAt"> {
    try {
      const deployedAgent: Omit<
        DeployedAgentType,
        "id" | "createdAt" | "updatedAt"
      > = {
        name: developmentAgent.name,
        description: developmentAgent.description,
        mcpServers: developmentAgent.mcpServers,
        purpose: developmentAgent.purpose,
        instructions: developmentAgent.instructions,
        autoExecuteTool: false,
        toolPermissions: developmentAgent.toolPermissions,
        userId: undefined,
        originalId: developmentAgent.id,
      };

      logInfo(
        `開発中エージェント "${developmentAgent.name}" をデプロイ済みエージェント形式に変換しました`,
      );
      return deployedAgent;
    } catch (error) {
      logError(
        `開発中エージェント "${developmentAgent.name}" の変換中にエラーが発生しました`,
        error,
      );
      throw error;
    }
  }

  /**
   * エージェント設定の機密情報をサニタイズする
   */
  public sanitizeAgentForSharing(agent: AgentConfig): any {
    try {
      const sanitized = {
        name: agent.name,
        purpose: agent.purpose,
        description: agent.description,
        instructions: agent.instructions,
        mcpServers: agent.mcpServers.map((server) => {
          const { bearerToken, ...sanitizedServer } = server;
          return {
            ...sanitizedServer,
            env: server.env
              ? Object.fromEntries(
                  Object.keys(server.env).map((key) => [key, ""]),
                )
              : {},
          };
        }),
        toolPermissions: agent.toolPermissions,
      };

      logInfo(`エージェント "${agent.name}" の共有用サニタイズが完了しました`);
      return sanitized;
    } catch (error) {
      logError(
        `エージェント "${agent.name}" のサニタイズ中にエラーが発生しました`,
        error,
      );
      throw error;
    }
  }

  /**
   * エージェント設定の互換性をチェックする
   */
  public checkCompatibility(agentData: any): {
    compatible: boolean;
    warnings: string[];
    errors: string[];
  } {
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // 基本的なバリデーション
      this.validateAgentConfig(agentData);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    // MCPサーバーの互換性チェック
    if (agentData.mcpServers && Array.isArray(agentData.mcpServers)) {
      for (const server of agentData.mcpServers) {
        // リモートサーバーの警告
        if (server.serverType === "remote" && !server.remoteUrl) {
          errors.push(
            `サーバー "${server.name}" にリモートURLが設定されていません`,
          );
        }

        // ローカルサーバーの警告
        if (server.serverType === "local") {
          warnings.push(
            `サーバー "${server.name}" はローカルサーバーです。実行環境で利用可能か確認してください`,
          );
        }

        // 環境変数の警告
        if (server.env && Object.keys(server.env).length > 0) {
          warnings.push(
            `サーバー "${server.name}" には環境変数が必要です。設定を確認してください`,
          );
        }
      }
    }

    // ツール権限の互換性チェック
    if (agentData.toolPermissions) {
      const serverIds = new Set(agentData.mcpServers.map((s: any) => s.id));
      for (const serverId of Object.keys(agentData.toolPermissions)) {
        if (!serverIds.has(serverId)) {
          warnings.push(
            `ツール権限に存在しないサーバー (ID: ${serverId}) の設定があります`,
          );
        }
      }
    }

    const compatible = errors.length === 0;

    logInfo(
      `エージェント互換性チェック完了: ${compatible ? "互換性あり" : "互換性なし"} (警告: ${warnings.length}, エラー: ${errors.length})`,
    );

    return {
      compatible,
      warnings,
      errors,
    };
  }
}

export { AgentSharingService };
