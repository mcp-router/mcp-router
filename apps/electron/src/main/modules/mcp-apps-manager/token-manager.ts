import crypto from "crypto";
import { McpAppsManagerRepository } from "./mcp-apps-manager.repository";
import {
  Token,
  TokenGenerateOptions,
  TokenValidationResult,
} from "@mcp_router/shared";

/**
 * トークン管理機能を提供するクラス
 */
export class TokenManager {
  /**
   * 新しいトークンを生成
   */
  public generateToken(options: TokenGenerateOptions): Token {
    const now = Math.floor(Date.now() / 1000);
    const clientId = options.clientId;

    // 同じクライアントIDのトークンが存在する場合は削除
    const clientTokens =
      McpAppsManagerRepository.getInstance().getTokensByClientId(clientId);
    if (clientTokens.length > 0) {
      McpAppsManagerRepository.getInstance().deleteClientTokens(clientId);
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
    };

    // トークンを永続化
    McpAppsManagerRepository.getInstance().saveToken(token);
    return token;
  }

  /**
   * トークンを検証
   */
  public validateToken(tokenId: string): TokenValidationResult {
    const token = McpAppsManagerRepository.getInstance().getToken(tokenId);

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
  }

  /**
   * トークンからクライアントIDを取得
   */
  public getClientIdFromToken(tokenId: string): string | null {
    const validation = this.validateToken(tokenId);
    return validation.isValid ? validation.clientId! : null;
  }

  /**
   * トークンを削除
   */
  public deleteToken(tokenId: string): boolean {
    return McpAppsManagerRepository.getInstance().deleteToken(tokenId);
  }

  /**
   * クライアントIDに関連付けられた全てのトークンを削除
   */
  public deleteClientTokens(clientId: string): number {
    return McpAppsManagerRepository.getInstance().deleteClientTokens(clientId);
  }

  /**
   * 全てのトークンをリスト表示
   */
  public listTokens(): Token[] {
    return McpAppsManagerRepository.getInstance().listTokens();
  }

  /**
   * トークンのサーバアクセス権限を確認
   */
  public hasServerAccess(tokenId: string, serverId: string): boolean {
    const token = McpAppsManagerRepository.getInstance().getToken(tokenId);
    if (!token) {
      return false;
    }
    return token.serverIds.includes(serverId);
  }

  /**
   * トークンのサーバアクセス権限を更新
   */
  public updateTokenServerAccess(
    tokenId: string,
    serverIds: string[],
  ): boolean {
    return McpAppsManagerRepository.getInstance().updateTokenServerIds(
      tokenId,
      serverIds,
    );
  }
}
