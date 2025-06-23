/**
 * トークン関連の型定義
 */
/**
 * アプリケーションスコープの定義
 */
export declare enum TokenScope {
    MCP_SERVER_MANAGEMENT = "mcp_server_management",// MCPサーバー管理（/mcpも含む）
    LOG_MANAGEMENT = "log_management",// ログ管理
    APPLICATION = "application"
}
/**
 * トークンのインターフェース
 */
export interface Token {
    id: string;
    clientId: string;
    issuedAt: number;
    serverIds: string[];
    scopes: TokenScope[];
}
/**
 * トークン生成時のオプション
 */
export interface TokenGenerateOptions {
    clientId: string;
    serverIds: string[];
    expiresIn?: number;
    scopes?: TokenScope[];
}
/**
 * トークン検証の結果
 */
export interface TokenValidationResult {
    isValid: boolean;
    clientId?: string;
    error?: string;
}
//# sourceMappingURL=token-types.d.ts.map