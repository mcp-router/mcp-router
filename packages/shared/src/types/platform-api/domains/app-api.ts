/**
 * Application management domain API (includes token management)
 */

import type {
  McpApp,
  McpAppsManagerResult,
  TokenScope,
} from "../../mcp-app-types";

interface Token {
  id: string;
  name: string;
  scopes: TokenScope[];
  createdAt: Date;
  lastUsed?: Date;
}

interface TokenGenerateOptions {
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
