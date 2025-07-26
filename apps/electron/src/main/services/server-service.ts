import { SingletonService } from "./singleton-service";
import { MCPServer, MCPServerConfig } from "@mcp_router/shared";
import { logInfo } from "../../lib/utils/backend/error-handler";
import { getServerRepository } from "../../lib/database";
import { getTokenService } from "./token-service";

/**
 * Service class for managing server information
 */
export class ServerService extends SingletonService<
  MCPServer,
  string,
  ServerService
> {
  /**
   * Constructor
   */
  protected constructor() {
    super();
  }

  /**
   * Get entity name
   */
  protected getEntityName(): string {
    return "Server";
  }

  /**
   * Get singleton instance of ServerService
   */
  public static getInstance(): ServerService {
    return (this as any).getInstanceBase();
  }

  /**
   * Reset instance (used when switching workspaces)
   */
  public static resetInstance(): void {
    this.resetInstanceBase(ServerService);
  }

  /**
   * サーバ情報を追加する
   * @param serverConfig サーバ設定情報
   * @returns 追加されたサーバ情報
   */
  public addServer(serverConfig: MCPServerConfig): MCPServer {
    try {
      const server = getServerRepository().addServer(serverConfig);

      // Give all MCP clients access to this new server
      try {
        const tokenService = getTokenService();
        const allTokens = tokenService.listTokens();

        // For each token, add this server's ID to its access list
        allTokens.forEach((token) => {
          // Check if the server is not already in the token's serverIds
          if (!token.serverIds.includes(server.id)) {
            // Add the new server ID to the token's server access list
            const updatedServerIds = [...token.serverIds, server.id];
            tokenService.updateTokenServerAccess(token.id, updatedServerIds);
          }
        });
      } catch (error) {
        // Log error but don't interrupt the server creation process
        console.error("Error updating tokens for new server access:", error);
      }

      return server;
    } catch (error) {
      return this.handleError("追加", error);
    }
  }

  /**
   * 全てのサーバ情報を取得する
   * @returns サーバ情報の配列
   */
  public getAllServers(): MCPServer[] {
    try {
      return getServerRepository().getAllServers();
    } catch (error) {
      return this.handleError("取得", error, []);
    }
  }

  /**
   * 指定されたIDのサーバ情報を取得する
   * @param id サーバID
   * @returns サーバ情報（存在しない場合はundefined）
   */
  public getServerById(id: string): MCPServer | undefined {
    try {
      return getServerRepository().getServerById(id);
    } catch (error) {
      return this.handleError(`ID:${id}の取得`, error, undefined);
    }
  }

  /**
   * サーバ情報を更新する
   * @param id サーバID
   * @param config 更新するサーバ設定情報
   * @returns 更新されたサーバ情報（存在しない場合はundefined）
   */
  public updateServer(
    id: string,
    config: Partial<MCPServerConfig>,
  ): MCPServer | undefined {
    try {
      const result = getServerRepository().updateServer(id, config);
      if (result) {
        logInfo(`サーバ "${result.name}" が更新されました (ID: ${id})`);
      }
      return result;
    } catch (error) {
      return this.handleError(`ID:${id}の更新`, error, undefined);
    }
  }

  /**
   * サーバ情報を削除する
   * @param id サーバID
   * @returns 削除に成功した場合はtrue、失敗した場合はfalse
   */
  public deleteServer(id: string): boolean {
    try {
      const server = this.getServerById(id);
      const result = getServerRepository().deleteServer(id);

      if (result && server) {
        logInfo(`サーバ "${server.name}" が削除されました (ID: ${id})`);
      }

      return result;
    } catch (error) {
      return this.handleError(`ID:${id}の削除`, error, false);
    }
  }
}

/**
 * ServerServiceのシングルトンインスタンスを取得
 */
export function getServerService(): ServerService {
  return ServerService.getInstance();
}
