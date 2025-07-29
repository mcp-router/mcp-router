import {
  DeployedAgent as DeployedAgentType,
  MCPServerConfig,
  MCPTool,
  MCPAgentToolPermission,
} from "@mcp_router/shared";
import { AgentBase } from "../shared/agent-base";
import { BaseAgentInfo } from "@mcp_router/shared";
import { logError, logInfo } from "@/main/utils/logger";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  connectToMCPServer,
  fetchServerTools,
  substituteArgsParameters,
} from "@/main/domain/mcp-core/client/mcp-client-util";

/**
 * サーバー情報を表す型
 */
type LightServerInfo = {
  config: MCPServerConfig;
  client?: Client;
  status: "running" | "stopped" | "error";
  lastError?: string;
};

/**
 * デプロイ済みエージェントクラス
 * 実行時のみの機能（ツール呼び出し等）を提供し、開発時の機能は除外
 */
export class DeployedAgent extends AgentBase {
  private serverInfoMap: Map<string, LightServerInfo> = new Map();
  private readonly userId?: string;

  /**
   * コンストラクタ
   * @param config デプロイ済みエージェント設定
   */
  constructor(config: DeployedAgentType) {
    // createdAt と updatedAt のデフォルト値を設定
    const normalizedConfig: BaseAgentInfo = {
      ...config,
      createdAt: config.createdAt || Date.now(),
      updatedAt: config.updatedAt || Date.now(),
    };

    super(normalizedConfig);
    this.userId = config.userId;

    // サーバー情報の初期化
    if (this.config.mcpServers && this.config.mcpServers.length > 0) {
      for (const server of this.config.mcpServers) {
        this.serverInfoMap.set(server.id, {
          config: server,
          status: "stopped",
        });
      }
    }
  }

  /**
   * デプロイ済みエージェントの設定を取得する
   */
  public getDeployedConfig(): DeployedAgentType {
    return {
      ...this.config,
      userId: this.userId,
    } as DeployedAgentType;
  }

  /**
   * エージェントの設定を更新する（デプロイ済み版）
   * @param newConfig 新しい設定（部分的）
   * @param syncToolPermissions ツール権限を同期するかどうか
   */
  public async updateConfig(
    newConfig: Partial<DeployedAgentType>,
    syncToolPermissions = true,
  ): Promise<DeployedAgentType> {
    // MCPサーバーの構成に変更があるかチェック
    let serversChanged = false;

    if (newConfig.mcpServers !== undefined) {
      serversChanged = this.hasServerConfigChanged(
        this.config.mcpServers || [],
        newConfig.mcpServers,
      );
    }

    // 設定を更新
    this.config = {
      ...this.config,
      ...newConfig,
      updatedAt: Date.now(),
      createdAt: this.config.createdAt,
    };

    // サーバー情報が変更された場合、サーバーマップを再初期化
    if (serversChanged) {
      this.serverInfoMap.clear();
      this.initializeServers();
    }

    // MCP サーバー構成が変更された場合、またはリクエストされた場合にツール権限を同期
    if ((serversChanged || syncToolPermissions) && this.config.mcpServers) {
      logInfo(
        `デプロイ済みエージェント ${this.getLogIdentifier()} のMCPサーバー構成変更検出: ${serversChanged ? "変更あり" : "変更なし"}`,
      );
      await this.synchronizeToolPermissions();
    }

    return this.getDeployedConfig();
  }

  /**
   * サーバー情報を初期化する
   */
  private initializeServers(): void {
    if (this.config.mcpServers && this.config.mcpServers.length > 0) {
      for (const server of this.config.mcpServers) {
        this.serverInfoMap.set(server.id, {
          config: server,
          status: "stopped",
        });
      }
    }
  }

  /**
   * 特定のサーバーに接続する
   * @returns 成功時はnull、失敗時はエラーメッセージ
   */
  private async connectToServer(serverId: string): Promise<string | null> {
    const server = this.findServerConfig(serverId);
    if (!server) {
      return `Server configuration not found (ID: ${serverId})`;
    }

    const serverInfo = this.serverInfoMap.get(serverId);
    if (!serverInfo) {
      return `Server info not found (ID: ${serverId})`;
    }

    // 既に接続済みの場合
    if (serverInfo.status === "running" && serverInfo.client) {
      return null; // 成功
    }

    // エラー状態の場合はリトライ
    if (serverInfo.status === "error") {
      logInfo(
        `サーバー "${server.name}" (ID: ${serverId}) がエラー状態のため再接続を試みます`,
      );
    }

    try {
      const result = await connectToMCPServer(
        {
          id: server.id,
          name: server.name,
          serverType: server.serverType,
          command: server.command,
          args: server.args
            ? substituteArgsParameters(
                server.args,
                server.env || {},
                server.inputParams || {},
              )
            : undefined,
          remoteUrl: server.remoteUrl,
          bearerToken: server.bearerToken,
          env: server.env,
          inputParams: server.inputParams,
        },
        `mcp-router-deployed-agent`,
      );

      if (result.status === "success") {
        serverInfo.client = result.client;
        serverInfo.status = "running";
        logInfo(
          `デプロイ済みエージェント ${this.getLogIdentifier()} がサーバー "${server.name}" (ID: ${serverId}) に接続しました`,
        );
        return null; // 成功
      } else {
        serverInfo.status = "error";
        serverInfo.lastError = result.error;
        logError(
          `デプロイ済みエージェント ${this.getLogIdentifier()} のサーバー "${server.name}" への接続に失敗しました: ${result.error}`,
        );
        return result.error; // Return raw error message
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logError(
        `デプロイ済みエージェント ${this.getLogIdentifier()} のサーバー "${server.name}" (ID: ${serverId}) への接続中にエラーが発生しました`,
        error,
      );
      serverInfo.status = "error";
      serverInfo.lastError = errorMessage;
      return errorMessage; // Return raw error message
    }
  }

  /**
   * サーバーから基本的なツール情報を取得する
   */
  private async fetchServerTools(serverId: string): Promise<MCPTool[]> {
    const serverInfo = this.serverInfoMap.get(serverId);
    if (!serverInfo?.client) {
      return [];
    }

    try {
      const tools = await fetchServerTools(serverInfo.client);

      return tools.map((tool) => ({
        name: tool.name,
        description: tool.description || "",
        inputSchema: tool.parameters || tool.inputSchema || undefined,
      }));
    } catch (error) {
      logError(
        `デプロイ済みエージェント ${this.getLogIdentifier()} のサーバー (${serverId}) からのツール取得中にエラーが発生しました`,
        error,
      );
      return [];
    }
  }

  /**
   * ツール名からそのツールを提供できるサーバーを検索する
   */
  public async findServerForTool(
    toolName: string,
  ): Promise<string | undefined> {
    if (!this.config.mcpServers || this.config.mcpServers.length === 0) {
      return undefined;
    }

    // まず、既に接続済みのサーバーから検索
    for (const server of this.config.mcpServers) {
      const serverInfo = this.serverInfoMap.get(server.id);
      if (serverInfo?.status === "running" && serverInfo.client) {
        try {
          const tools = await this.fetchServerTools(server.id);
          if (tools.some((tool) => tool.name === toolName)) {
            logInfo(
              `ツール "${toolName}" をサーバー "${server.name}" (ID: ${server.id}) で見つけました`,
            );
            return server.id;
          }
        } catch (error) {
          logError(
            `サーバー (ID: ${server.id}) からのツール検索中にエラーが発生しました`,
            error,
          );
        }
      }
    }

    // 接続済みサーバーで見つからなかった場合、未接続のサーバーに接続して検索
    for (const server of this.config.mcpServers) {
      const serverInfo = this.serverInfoMap.get(server.id);
      if (serverInfo?.status !== "running") {
        const errorMessage = await this.connectToServer(server.id);
        if (errorMessage) {
          logError(`ツール検索時のサーバー接続エラー: ${errorMessage}`);
          continue;
        }

        try {
          const tools = await this.fetchServerTools(server.id);
          if (tools.some((tool) => tool.name === toolName)) {
            logInfo(
              `ツール "${toolName}" をサーバー "${server.name}" (ID: ${server.id}) で見つけました`,
            );
            return server.id;
          }
        } catch (error) {
          logError(
            `サーバー (ID: ${server.id}) からのツール検索中にエラーが発生しました`,
            error,
          );
        }
      }
    }

    return undefined;
  }

  /**
   * MCPツールを呼び出す
   */
  public async callTool(
    toolName: string,
    args: Record<string, any>,
  ): Promise<any> {
    try {
      // findServerForToolが既にサーバーに接続している
      const serverId = await this.findServerForTool(toolName);
      if (!serverId) {
        throw new Error(
          `ツール "${toolName}" を提供できるサーバーが見つかりません`,
        );
      }

      // ツールの権限をチェック
      const isEnabled = this.getToolPermission(serverId, toolName);
      if (!isEnabled) {
        throw new Error(
          `ツール "${toolName}" はこのエージェントでは許可されていません`,
        );
      }

      // findServerForToolが既にサーバーに接続しているため、再度接続する必要はない
      // ただし、クライアントが存在するか確認
      const serverInfo = this.serverInfoMap.get(serverId);
      if (!serverInfo?.client) {
        // クライアントがない場合のみ再接続を試みる
        const errorMessage = await this.connectToServer(serverId);
        if (errorMessage) {
          throw new Error(`サーバー (ID: ${serverId}) に接続できませんでした`);
        }

        const updatedServerInfo = this.serverInfoMap.get(serverId);
        if (!updatedServerInfo?.client) {
          throw new Error(
            `サーバー (ID: ${serverId}) のクライアントが利用できません`,
          );
        }

        const result = await updatedServerInfo.client.callTool({
          name: toolName,
          arguments: args,
        });

        logInfo(
          `デプロイ済みエージェント ${this.getLogIdentifier()} がツール "${toolName}" を呼び出しました`,
        );
        return result;
      }

      const result = await serverInfo.client.callTool({
        name: toolName,
        arguments: args,
      });

      logInfo(
        `デプロイ済みエージェント ${this.getLogIdentifier()} がツール "${toolName}" を呼び出しました`,
      );
      return result;
    } catch (error) {
      logError(
        `デプロイ済みエージェント ${this.getLogIdentifier()} のツール呼び出し中にエラーが発生しました`,
        error,
      );
      throw error;
    }
  }

  /**
   * 利用可能なツール一覧を取得する
   */
  public async getAvailableTools(): Promise<Record<string, MCPTool[]>> {
    try {
      const result: Record<string, MCPTool[]> = {};

      // 接続済みサーバーを優先的に処理
      const connectedServers: string[] = [];
      const unconnectedServers: MCPServerConfig[] = [];

      for (const server of this.config.mcpServers) {
        const serverInfo = this.serverInfoMap.get(server.id);
        if (serverInfo?.status === "running" && serverInfo.client) {
          connectedServers.push(server.id);
        } else {
          unconnectedServers.push(server);
        }
      }

      // 接続済みサーバーからツールを取得
      for (const serverId of connectedServers) {
        try {
          const tools = await this.fetchServerTools(serverId);
          if (tools && tools.length > 0) {
            const enabledTools = tools.filter((tool) =>
              this.getToolPermission(serverId, tool.name),
            );
            if (enabledTools.length > 0) {
              result[serverId] = enabledTools;
            }
          }
        } catch (error) {
          const server = this.findServerConfig(serverId);
          logError(
            `デプロイ済みエージェント ${this.getLogIdentifier()} のサーバー "${server?.name}" (ID: ${serverId}) からのツール取得中にエラーが発生しました`,
            error,
          );
        }
      }

      // 未接続サーバーに接続してツールを取得
      for (const server of unconnectedServers) {
        try {
          const errorMessage = await this.connectToServer(server.id);
          if (errorMessage) {
            logError(
              `利用可能ツール取得時のサーバー接続エラー: ${errorMessage}`,
            );
            continue;
          }

          const tools = await this.fetchServerTools(server.id);
          if (tools && tools.length > 0) {
            const enabledTools = tools.filter((tool) =>
              this.getToolPermission(server.id, tool.name),
            );
            if (enabledTools.length > 0) {
              result[server.id] = enabledTools;
            }
          }
        } catch (error) {
          logError(
            `デプロイ済みエージェント ${this.getLogIdentifier()} のサーバー "${server.name}" (ID: ${server.id}) からのツール取得中にエラーが発生しました`,
            error,
          );
        }
      }

      return result;
    } catch (error) {
      logError(
        `デプロイ済みエージェント ${this.getLogIdentifier()} の利用可能ツール取得中にエラーが発生しました`,
        error,
      );
      return {};
    }
  }

  /**
   * 特定のMCPサーバーのツールを取得する（単一サーバーのみ）
   */
  public async getMCPServerTools(
    serverId: string,
  ): Promise<(MCPTool & { enabled?: boolean })[]> {
    const server = this.findServerConfig(serverId);
    if (!server) {
      throw new Error(`Server configuration not found (ID: ${serverId})`);
    }

    // サーバーに接続（必要な場合のみ）
    const serverInfo = this.serverInfoMap.get(serverId);
    if (!serverInfo || serverInfo.status !== "running" || !serverInfo.client) {
      const errorMessage = await this.connectToServer(serverId);
      if (errorMessage) {
        throw new Error(errorMessage);
      }
    }

    // ツールを取得
    const tools = await this.fetchServerTools(serverId);
    if (!tools || tools.length === 0) {
      return [];
    }

    // 権限情報を付与して返す
    const toolsWithPermissions = tools.map((tool) => ({
      ...tool,
      enabled: this.getToolPermission(serverId, tool.name),
    }));

    return toolsWithPermissions;
  }

  /**
   * サーバー接続を閉じる
   */
  public closeConnections(): void {
    try {
      for (const [serverId, serverInfo] of this.serverInfoMap) {
        if (serverInfo.client) {
          try {
            serverInfo.client.close();
            serverInfo.client = undefined;
            serverInfo.status = "stopped";
          } catch (error) {
            logError(
              `デプロイ済みエージェント ${this.getLogIdentifier()} のサーバー (ID: ${serverId}) のクライアント切断中にエラーが発生しました`,
              error,
            );
          }
        }
      }

      logInfo(
        `デプロイ済みエージェント ${this.getLogIdentifier()} の全サーバー接続を閉じました`,
      );
    } catch (error) {
      logError(
        `デプロイ済みエージェント ${this.getLogIdentifier()} のサーバー接続切断中にエラーが発生しました`,
        error,
      );
    }
  }

  /**
   * サーバーの接続状態を取得する
   */
  public getServerStatus(
    serverId: string,
  ): "running" | "stopped" | "error" | undefined {
    return this.serverInfoMap.get(serverId)?.status;
  }

  /**
   * 全サーバーの接続状態を取得する
   */
  public getAllServerStatuses(): Record<
    string,
    "running" | "stopped" | "error"
  > {
    const statuses: Record<string, "running" | "stopped" | "error"> = {};

    for (const [serverId, serverInfo] of this.serverInfoMap) {
      statuses[serverId] = serverInfo.status;
    }

    return statuses;
  }

  /**
   * ツール権限を同期する（デプロイ済み版簡易実装）
   */
  private async synchronizeToolPermissions(): Promise<void> {
    try {
      logInfo(
        `デプロイ済みエージェント ${this.getLogIdentifier()} のツール権限を同期中...`,
      );

      let updatedToolPermissions: Record<string, MCPAgentToolPermission[]> = {};

      if (this.config.toolPermissions) {
        updatedToolPermissions = JSON.parse(
          JSON.stringify(this.config.toolPermissions),
        );
      }

      const existingServerIds = new Set(
        this.config.mcpServers.map((server) => server.id),
      );

      // 存在しないサーバーの権限を削除
      for (const serverId of Object.keys(updatedToolPermissions)) {
        if (!existingServerIds.has(serverId)) {
          delete updatedToolPermissions[serverId];
          logInfo(
            `サーバー (ID: ${serverId}) が存在しないため、ツール権限を削除しました`,
          );
        }
      }

      // 各サーバーのツール権限を更新（必要な場合のみ接続）
      for (const server of this.config.mcpServers) {
        const serverId = server.id;
        const serverInfo = this.serverInfoMap.get(serverId);

        // サーバーが既に接続済みで、ツール権限が既に存在する場合はスキップ
        if (
          serverInfo?.status === "running" &&
          updatedToolPermissions[serverId] &&
          updatedToolPermissions[serverId].length > 0
        ) {
          logInfo(
            `サーバー (ID: ${serverId}) は既に接続済みで、ツール権限も存在するためスキップします`,
          );
          continue;
        }

        logInfo(`サーバー (ID: ${serverId}) のツール権限を同期中...`);
        const errorMessage = await this.connectToServer(serverId);
        if (errorMessage) {
          logError(
            `サーバー (ID: ${serverId}) に接続できなかったため、ツール権限を更新できません`,
          );
          continue;
        }

        try {
          const tools = await this.fetchServerTools(serverId);

          if (tools && tools.length > 0) {
            const currentServerPermissions =
              updatedToolPermissions[serverId] || [];

            const updatedServerPermissions = tools.map((tool) => {
              const existingPermission = currentServerPermissions.find(
                (p) => p.toolName === tool.name,
              );

              return {
                toolName: tool.name,
                inputSchema: tool.inputSchema,
                description:
                  tool.description ||
                  existingPermission?.description ||
                  tool.name ||
                  "",
                enabled: existingPermission ? existingPermission.enabled : true,
              };
            });

            updatedToolPermissions[serverId] = updatedServerPermissions;
            logInfo(
              `サーバー (ID: ${serverId}) のツール権限を更新しました (${updatedServerPermissions.length} ツール)`,
            );
          }
        } catch (error) {
          logError(
            `サーバー (ID: ${serverId}) からのツール取得中にエラーが発生しました`,
            error,
          );
        }
      }

      this.config.toolPermissions = updatedToolPermissions;
      logInfo(
        `デプロイ済みエージェント ${this.getLogIdentifier()} のツール権限同期が完了しました`,
      );
    } catch (error) {
      logError(
        `デプロイ済みエージェント ${this.getLogIdentifier()} のツール権限同期中にエラーが発生しました`,
        error,
      );
    }
  }
}
