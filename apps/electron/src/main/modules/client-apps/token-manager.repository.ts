import { Token, TokenServerAccess } from "@mcp_router/shared";
import { getSharedConfigManager } from "../../infrastructure/shared-config-manager";

/**
 * Token repository class
 * Uses SharedConfigManager for shared config file management
 */
export class TokenManagerRepository {
  private static instance: TokenManagerRepository | null = null;

  private constructor() {
    console.log(
      "[TokenManagerRepository] Using SharedConfigManager for token storage",
    );
  }

  public static getInstance(): TokenManagerRepository {
    if (!TokenManagerRepository.instance) {
      TokenManagerRepository.instance = new TokenManagerRepository();
    }
    return TokenManagerRepository.instance;
  }

  public static resetInstance(): void {
    TokenManagerRepository.instance = null;
  }

  public getToken(id: string): Token | null {
    const manager = getSharedConfigManager();
    const token = manager.getToken(id);
    return token || null;
  }

  public saveToken(token: Token): void {
    getSharedConfigManager().saveToken(token);
  }

  public listTokens(): Token[] {
    return getSharedConfigManager().getTokens();
  }

  public deleteToken(id: string): boolean {
    try {
      getSharedConfigManager().deleteToken(id);
      return true;
    } catch (error) {
      console.error(`Error deleting token ${id}:`, error);
      return false;
    }
  }

  public deleteClientTokens(clientId: string): number {
    try {
      const manager = getSharedConfigManager();
      const beforeCount = manager.getTokensByClientId(clientId).length;
      manager.deleteClientTokens(clientId);
      return beforeCount;
    } catch (error) {
      console.error(
        `Error deleting tokens for client ${clientId}:`,
        error,
      );
      throw error;
    }
  }

  public updateTokenServerAccess(
    id: string,
    serverAccess: TokenServerAccess,
  ): boolean {
    try {
      getSharedConfigManager().updateTokenServerAccess(id, serverAccess);
      return true;
    } catch (error) {
      console.error(`Error updating token ${id}:`, error);
      return false;
    }
  }

  public getTokensByClientId(clientId: string): Token[] {
    try {
      return getSharedConfigManager().getTokensByClientId(clientId);
    } catch (error) {
      console.error(
        `Error getting tokens for client ID ${clientId}:`,
        error,
      );
      throw error;
    }
  }

  public getById(id: string): Token | undefined {
    const manager = getSharedConfigManager();
    return manager.getToken(id);
  }

  public getAll(): Token[] {
    return this.listTokens();
  }

  public add(token: Token): Token {
    this.saveToken(token);
    return token;
  }

  public update(id: string, token: Token): Token | undefined {
    const existing = this.getById(id);
    if (existing) {
      this.saveToken(token);
      return token;
    }
    return undefined;
  }

  public delete(id: string): boolean {
    return this.deleteToken(id);
  }
}
