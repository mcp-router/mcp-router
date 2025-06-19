import { Token, TokenGenerateOptions, TokenValidationResult, TokenScope } from '../types/token-types';
import { BaseService } from './base-service';
import { Singleton } from '../utils/singleton';
import { TokenRepository, getTokenRepository } from '../database/token-repository';
import crypto from 'crypto';

/**
 * アクセストークンを管理するサービス
 */
export class TokenService extends BaseService<Token, string> implements Singleton<TokenService> {
  private static instance: TokenService | null = null;
  
  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService();
    }
    return TokenService.instance;
  }
  
  private repository: TokenRepository;
  
  /**
   * コンストラクタ
   */
  private constructor() {
    super();
    this.repository = getTokenRepository();
  }
  
  /**
   * エンティティ名を取得
   */
  protected getEntityName(): string {
    return 'トークン';
  }

  /**
   * 新しいトークンを生成
   */
  public generateToken(options: TokenGenerateOptions): Token {
    try {
      const now = Math.floor(Date.now() / 1000);
      const clientId = options.clientId;
      
      // 同じクライアントIDのトークンが存在する場合は削除
      const clientTokens = this.repository.getTokensByClientId(clientId);
      if (clientTokens.length > 0) {
        this.repository.deleteClientTokens(clientId);
      }

      // より強固なランダム値を生成（24バイト = 192ビット）
      const randomBytes = crypto.randomBytes(24).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, ''); // URL安全なBase64形式に変換
      
      const token: Token = {
        id: "mcpr_" + randomBytes,
        clientId,
        issuedAt: now,
        serverIds: options.serverIds || [],
        scopes: options.scopes || [TokenScope.MCP_SERVER_MANAGEMENT, TokenScope.LOG_MANAGEMENT, TokenScope.APPLICATION]
      };

      // トークンを永続化
      this.repository.saveToken(token);
      return token;
    } catch (error) {
      return this.handleError('トークン生成', error);
    }
  }

  /**
   * トークンを検証
   */
  public validateToken(tokenId: string): TokenValidationResult {
    try {
      const token = this.repository.getToken(tokenId);

      if (!token) {
        return {
          isValid: false,
          error: 'Token not found'
        };
      }

      return {
        isValid: true,
        clientId: token.clientId
      };
    } catch (error) {
      return this.handleError('トークン検証', error, {
        isValid: false,
        error: `検証中にエラーが発生しました: ${error.message}`
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
      this.handleError('クライアントID取得', error);
      return null;
    }
  }

  /**
   * トークンを削除
   */
  public deleteToken(tokenId: string): boolean {
    try {
      return this.repository.deleteToken(tokenId);
    } catch (error) {
      return this.handleError(`ID:${tokenId}の削除`, error, false);
    }
  }

  /**
   * クライアントIDに関連付けられた全てのトークンを削除
   */
  public deleteClientTokens(clientId: string): number {
    try {
      return this.repository.deleteClientTokens(clientId);
    } catch (error) {
      return this.handleError(`クライアント${clientId}のトークン削除`, error, 0);
    }
  }

  /**
   * 全てのトークンをリスト表示
   */
  public listTokens(): Token[] {
    try {
      return this.repository.listTokens();
    } catch (error) {
      return this.handleError('一覧取得', error, []);
    }
  }

  /**
   * トークンのサーバアクセス権限を確認
   */
  public hasServerAccess(tokenId: string, serverId: string): boolean {
    try {
      const token = this.repository.getToken(tokenId);
      if (!token) {
        return false;
      }
      return token.serverIds.includes(serverId);
    } catch (error) {
      return this.handleError('サーバアクセス権限確認', error, false);
    }
  }

  /**
   * トークンのサーバアクセス権限を更新
   */
  public updateTokenServerAccess(tokenId: string, serverIds: string[]): boolean {
    try {
      return this.repository.updateTokenServerIds(tokenId, serverIds);
    } catch (error) {
      return this.handleError('サーバアクセス権限更新', error, false);
    }
  }

  /**
   * トークンのスコープ権限を確認
   */
  public hasScope(tokenId: string, requiredScope: TokenScope): boolean {
    try {
      const token = this.repository.getToken(tokenId);
      if (!token) {
        return false;
      }
      return token.scopes?.includes(requiredScope) || false;
    } catch (error) {
      return this.handleError('スコープ権限確認', error, false);
    }
  }

  /**
   * トークンのスコープを更新
   */
  public updateTokenScopes(tokenId: string, scopes: TokenScope[]): boolean {
    try {
      const token = this.repository.getToken(tokenId);
      if (!token) {
        return false;
      }
      
      token.scopes = scopes;
      this.repository.saveToken(token);
      return true;
    } catch (error) {
      return this.handleError('スコープ更新', error, false);
    }
  }
}

/**
 * TokenServiceのシングルトンインスタンスを取得
 */
export function getTokenService(): TokenService {
  return TokenService.getInstance();
}
