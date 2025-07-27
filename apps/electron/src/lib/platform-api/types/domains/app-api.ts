/**
 * Application management domain API (includes token management)
 */

import { McpApp, McpAppsManagerResult, TokenScope } from "@mcp_router/shared";

export interface Token {
  id: string;
  name: string;
  scopes: TokenScope[];
  createdAt: Date;
  lastUsed?: Date;
}

export interface TokenGenerateOptions {
  name: string;
  scopes: TokenScope[];
  expiresIn?: number;
}


export interface AppAPI {
  // App management
  list(): Promise<McpApp[]>;
  create(appName: string): Promise<McpAppsManagerResult>;
  delete(appName: string): Promise<boolean>;
  updateServerAccess(
    appName: string,
    serverIds: string[],
  ): Promise<McpAppsManagerResult>;
  unifyConfig(appName: string): Promise<McpAppsManagerResult>;

  // Token management
  tokens: {
    updateScopes(
      tokenId: string,
      scopes: TokenScope[],
    ): Promise<McpAppsManagerResult>;
    generate(options: TokenGenerateOptions): Promise<string>;
    revoke(tokenId: string): Promise<void>;
    list(): Promise<Token[]>;
  };
}
