import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { TokenManager } from "@/main/modules/client-apps/token-manager";
import {
  Token,
  TokenServerAccess,
  TokenValidationResult,
} from "@mcp_router/shared";

export class TokenValidator {
  private tokenManager: TokenManager;
  private serverNameToIdMap: ReadonlyMap<string, string>;

  constructor(serverNameToIdMap: ReadonlyMap<string, string>) {
    this.serverNameToIdMap = serverNameToIdMap;
    this.tokenManager = new TokenManager();
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
    // Normal authentication logic
    if (!token || typeof token !== "string") {
      throw new McpError(ErrorCode.InvalidRequest, "Token is required");
    }

    const validation = this.tokenManager.validateToken(token);
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
    if (!this.tokenManager.hasServerAccess(token, serverId)) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        "Token does not have access to this server",
      );
    }

    if (!validation.clientId) {
      throw new McpError(
        ErrorCode.InternalError,
        "Token validated but clientId is missing",
      );
    }

    return validation.clientId;
  }

  /**
   * Check if a token has access to a server
   */
  public hasServerAccess(token: string, serverId: string): boolean {
    return this.tokenManager.hasServerAccess(token, serverId);
  }

  /**
   * Validate a token
   */
  public validateToken(token: string): TokenValidationResult {
    return this.tokenManager.validateToken(token);
  }

  /**
   * Update token server access
   */
  public updateTokenServerAccess(
    tokenId: string,
    serverAccess: TokenServerAccess,
  ): void {
    this.tokenManager.updateTokenServerAccess(tokenId, serverAccess);
  }

  /**
   * List all tokens
   */
  public listTokens(): Token[] {
    return this.tokenManager.listTokens();
  }
}
