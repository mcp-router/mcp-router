import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { getTokenService } from "@/main/domain/mcp-core/token/token-service";

export class TokenValidator {
  private tokenService: any;
  private serverNameToIdMap: Map<string, string>;

  constructor(serverNameToIdMap: Map<string, string>) {
    this.serverNameToIdMap = serverNameToIdMap;
    this.tokenService = getTokenService();
  }

  /**
   * Get server ID by name
   */
  private getServerIdByName(name: string): string | undefined {
    return this.serverNameToIdMap.get(name);
  }

  /**
   * Validate token and check server access in one step
   * @param token The token to validate
   * @param serverName The server name to check access for
   * @returns The client ID if token is valid and has access, throws error otherwise
   */
  public validateTokenAndAccess(
    token: string | undefined,
    serverName: string,
  ): string {
    // 通常の認証ロジック
    if (!token || typeof token !== "string") {
      throw new McpError(ErrorCode.InvalidRequest, "Token is required");
    }

    const validation = this.tokenService.validateToken(token);
    if (!validation.isValid) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        validation.error || "Invalid token",
      );
    }

    // Get server ID from name
    const serverId = this.getServerIdByName(serverName);
    if (!serverId) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Unknown server: ${serverName}`,
      );
    }

    // Check server access
    if (!this.tokenService.hasServerAccess(token, serverId)) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        "Token does not have access to this server",
      );
    }

    return validation.clientId!;
  }

  /**
   * Check if a token has access to a server
   */
  public hasServerAccess(token: string, serverId: string): boolean {
    return this.tokenService.hasServerAccess(token, serverId);
  }

  /**
   * Validate a token
   */
  public validateToken(token: string): any {
    return this.tokenService.validateToken(token);
  }

  /**
   * Update token server access
   */
  public updateTokenServerAccess(tokenId: string, serverIds: string[]): void {
    this.tokenService.updateTokenServerAccess(tokenId, serverIds);
  }

  /**
   * List all tokens
   */
  public listTokens(): any[] {
    return this.tokenService.listTokens();
  }
}
