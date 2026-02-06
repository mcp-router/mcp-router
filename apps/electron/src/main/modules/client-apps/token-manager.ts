import crypto from "crypto";
import { TokenManagerRepository } from "./token-manager.repository";
import {
  Token,
  TokenGenerateOptions,
  TokenValidationResult,
  TokenServerAccess,
} from "@mcp_router/shared";

/**
 * Token management class
 */
export class TokenManager {
  /**
   * Generate a new token
   */
  public generateToken(options: TokenGenerateOptions): Token {
    const now = Math.floor(Date.now() / 1000);
    const clientId = options.clientId;

    // Delete existing tokens for the same client ID
    const clientTokens =
      TokenManagerRepository.getInstance().getTokensByClientId(clientId);
    if (clientTokens.length > 0) {
      TokenManagerRepository.getInstance().deleteClientTokens(clientId);
    }

    // Only set expiration if explicitly requested
    const expiresAt = options.expiresIn ? now + options.expiresIn : undefined;

    // Generate strong random value (24 bytes = 192 bits)
    const randomBytes = crypto
      .randomBytes(24)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, ""); // URL-safe Base64

    const token: Token = {
      id: "mcpr_" + randomBytes,
      clientId,
      issuedAt: now,
      serverAccess: options.serverAccess || {},
      expiresAt,
    };

    // Persist the token
    TokenManagerRepository.getInstance().saveToken(token);
    return token;
  }

  /**
   * Validate token including expiration check
   */
  public validateToken(tokenId: string): TokenValidationResult {
    const token = TokenManagerRepository.getInstance().getToken(tokenId);

    if (!token) {
      return {
        isValid: false,
        error: "Token not found",
      };
    }

    // Check expiration if set
    if (token.expiresAt) {
      const now = Math.floor(Date.now() / 1000);
      if (now > token.expiresAt) {
        return {
          isValid: false,
          error: "Token has expired",
        };
      }
    }

    return {
      isValid: true,
      clientId: token.clientId,
    };
  }

  /**
   * Get client ID from token
   */
  public getClientIdFromToken(tokenId: string): string | null {
    const validation = this.validateToken(tokenId);
    return validation.isValid ? validation.clientId! : null;
  }

  /**
   * Delete a token
   */
  public deleteToken(tokenId: string): boolean {
    return TokenManagerRepository.getInstance().deleteToken(tokenId);
  }

  /**
   * Delete all tokens for a client ID
   */
  public deleteClientTokens(clientId: string): number {
    return TokenManagerRepository.getInstance().deleteClientTokens(clientId);
  }

  /**
   * List all tokens
   */
  public listTokens(): Token[] {
    return TokenManagerRepository.getInstance().listTokens();
  }

  /**
   * Check if a token has access to a server
   */
  public hasServerAccess(tokenId: string, serverId: string): boolean {
    const token = TokenManagerRepository.getInstance().getToken(tokenId);
    if (!token) {
      return false;
    }
    return !!token.serverAccess?.[serverId];
  }

  /**
   * Update token server access permissions
   */
  public updateTokenServerAccess(
    tokenId: string,
    serverAccess: TokenServerAccess,
  ): boolean {
    return TokenManagerRepository.getInstance().updateTokenServerAccess(
      tokenId,
      serverAccess || {},
    );
  }
}
