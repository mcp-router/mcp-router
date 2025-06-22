import {
  MCPServerConfig,
  MCPTool,
  MCPAgentToolPermission,
} from "@mcp-router/shared";
import { logError, logInfo } from "../../../../lib/utils/backend/error-handler";

/**
 * エージェントの基本情報を表すインターフェース
 */
export interface BaseAgentInfo {
  id: string;
  name: string;
  purpose: string;
  description: string;
  instructions: string;
  mcpServers: MCPServerConfig[];
  toolPermissions?: Record<string, MCPAgentToolPermission[]>;
  createdAt: number;
  updatedAt: number;
}

/**
 * エージェントの共通ベースクラス
 * 最小限の共通機能のみを提供
 */
export abstract class AgentBase {
  protected id: string;
  protected config: BaseAgentInfo;

  constructor(config: BaseAgentInfo) {
    this.id = config.id;
    this.config = config;
  }

  /**
   * エージェントIDを取得
   */
  public getId(): string {
    return this.id;
  }

  /**
   * エージェント名を取得
   */
  public getName(): string {
    return this.config.name;
  }

  /**
   * エージェントの基本情報を取得
   */
  public getBasicInfo(): BaseAgentInfo {
    return { ...this.config };
  }

  /**
   * 特定のツールの権限状態を取得する
   * @param serverId サーバID
   * @param toolName ツール名
   * @returns 権限状態（有効/無効）
   */
  protected getToolPermission(serverId: string, toolName: string): boolean {
    if (!this.config.toolPermissions) {
      return true; // デフォルトで有効
    }

    const serverTools = this.config.toolPermissions[serverId];
    if (serverTools && Array.isArray(serverTools)) {
      const toolPermission = serverTools.find(
        (tool) => tool.toolName === toolName,
      );
      if (toolPermission) {
        return toolPermission.enabled;
      }
    }

    return true; // 権限が明示的に設定されていない場合はデフォルトで有効
  }

  /**
   * MCPサーバー設定からサーバーを検索する
   * @param serverId サーバーID
   * @returns サーバー設定（見つからない場合はundefined）
   */
  protected findServerConfig(serverId: string): MCPServerConfig | undefined {
    return this.config.mcpServers.find((server) => server.id === serverId);
  }

  /**
   * ログ出力用のエージェント識別子を取得
   */
  protected getLogIdentifier(): string {
    return `"${this.config.name}" (ID: ${this.id})`;
  }

  /**
   * 2つのサーバー配列が実質的に同じかどうかを比較する
   */
  protected hasServerConfigChanged(
    currentServers: MCPServerConfig[],
    newServers: MCPServerConfig[],
  ): boolean {
    if (currentServers.length !== newServers.length) {
      return true;
    }

    const serverMap = new Map<string, MCPServerConfig>();
    currentServers.forEach((server) => {
      serverMap.set(server.id, server);
    });

    for (const newServer of newServers) {
      const currentServer = serverMap.get(newServer.id);

      if (!currentServer) {
        return true;
      }

      if (
        newServer.name !== currentServer.name ||
        newServer.command !== currentServer.command ||
        newServer.serverType !== currentServer.serverType ||
        newServer.remoteUrl !== currentServer.remoteUrl ||
        newServer.disabled !== currentServer.disabled ||
        newServer.autoStart !== currentServer.autoStart
      ) {
        return true;
      }

      if (JSON.stringify(newServer.env) !== JSON.stringify(currentServer.env)) {
        return true;
      }

      if (
        JSON.stringify(newServer.args) !== JSON.stringify(currentServer.args)
      ) {
        return true;
      }
    }

    return false;
  }
}
