import {
  Token,
  TokenGenerateOptions,
  TokenValidationResult,
  TokenScope,
} from "@mcp_router/shared";
import { SingletonService } from "@/main/application/core/singleton-service";
import { getTokenRepository } from "../../../infrastructure/database";
import crypto from "crypto";

/**
 * Service for managing access tokens
 */
export class TokenService extends SingletonService<
  Token,
  string,
  TokenService
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
    return "Token";
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): TokenService {
    return (this as any).getInstanceBase();
  }

  /**
   * Reset instance
   * Used when switching workspaces
   * Note: TokenService is not reset as tokens are shared across workspaces
   */
  public static resetInstance(): void {
    // トークンはワークスペース間で共有されるため、リセットしない
    console.log(
      "[TokenService] Skip reset - tokens are shared across workspaces",
    );
  }

  /**
   * 新しいトークンを生成
   */
  public generateToken(options: TokenGenerateOptions): Token {
    try {
      const now = Math.floor(Date.now() / 1000);
      const clientId = options.clientId;

      // 同じクライアントIDのトークンが存在する場合は削除
      const clientTokens = getTokenRepository().getTokensByClientId(clientId);
      if (clientTokens.length > 0) {
        getTokenRepository().deleteClientTokens(clientId);
      }

      // より強固なランダム値を生成（24バイト = 192ビット）
      const randomBytes = crypto
        .randomBytes(24)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, ""); // URL安全なBase64形式に変換

      const token: Token = {
        id: "mcpr_" + randomBytes,
        clientId,
        issuedAt: now,
        serverIds: options.serverIds || [],
        scopes: options.scopes || [
          TokenScope.MCP_SERVER_MANAGEMENT,
          TokenScope.LOG_MANAGEMENT,
          TokenScope.APPLICATION,
        ],
      };

      // トークンを永続化
      getTokenRepository().saveToken(token);
      return token;
    } catch (error) {
      return this.handleError("トークン生成", error);
    }
  }

  /**
   * トークンを検証
   */
  public validateToken(tokenId: string): TokenValidationResult {
    try {
      const token = getTokenRepository().getToken(tokenId);

      if (!token) {
        return {
          isValid: false,
          error: "Token not found",
        };
      }

      return {
        isValid: true,
        clientId: token.clientId,
      };
    } catch (error) {
      return this.handleError("トークン検証", error, {
        isValid: false,
        error: `検証中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * トークンからクライアントIDを取得
   */
  public getClientIdFromToken(tokenId: string): string | null {
    try {
      const validation = this.validateToken(tokenId);
      return validation.isValid ? validation.clientId! : null;
    } catch (error) {
      this.handleError("クライアントID取得", error);
      return null;
    }
  }

  /**
   * トークンを削除
   */
  public deleteToken(tokenId: string): boolean {
    try {
      return getTokenRepository().deleteToken(tokenId);
    } catch (error) {
      return this.handleError(`ID:${tokenId}の削除`, error, false);
    }
  }

  /**
   * クライアントIDに関連付けられた全てのトークンを削除
   */
  public deleteClientTokens(clientId: string): number {
    try {
      return getTokenRepository().deleteClientTokens(clientId);
    } catch (error) {
      return this.handleError(
        `クライアント${clientId}のトークン削除`,
        error,
        0,
      );
    }
  }

  /**
   * 全てのトークンをリスト表示
   */
  public listTokens(): Token[] {
    try {
      return getTokenRepository().listTokens();
    } catch (error) {
      return this.handleError("一覧取得", error, []);
    }
  }

  /**
   * トークンのサーバアクセス権限を確認
   */
  public hasServerAccess(tokenId: string, serverId: string): boolean {
    try {
      const token = getTokenRepository().getToken(tokenId);
      if (!token) {
        return false;
      }
      return token.serverIds.includes(serverId);
    } catch (error) {
      return this.handleError("サーバアクセス権限確認", error, false);
    }
  }

  /**
   * トークンのサーバアクセス権限を更新
   */
  public updateTokenServerAccess(
    tokenId: string,
    serverIds: string[],
  ): boolean {
    try {
      return getTokenRepository().updateTokenServerIds(tokenId, serverIds);
    } catch (error) {
      return this.handleError("サーバアクセス権限更新", error, false);
    }
  }

  /**
   * トークンのスコープ権限を確認
   */
  public hasScope(tokenId: string, requiredScope: TokenScope): boolean {
    try {
      const token = getTokenRepository().getToken(tokenId);
      if (!token) {
        return false;
      }
      return token.scopes?.includes(requiredScope) || false;
    } catch (error) {
      return this.handleError("スコープ権限確認", error, false);
    }
  }

  /**
   * トークンのスコープを更新
   */
  public updateTokenScopes(tokenId: string, scopes: TokenScope[]): boolean {
    try {
      const token = getTokenRepository().getToken(tokenId);
      if (!token) {
        return false;
      }

      token.scopes = scopes;
      getTokenRepository().saveToken(token);
      return true;
    } catch (error) {
      return this.handleError("スコープ更新", error, false);
    }
  }
}

/**
 * TokenServiceのシングルトンインスタンスを取得
 */
export function getTokenService(): TokenService {
  return TokenService.getInstance();
}
