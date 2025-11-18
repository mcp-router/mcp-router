/**
 * Application management domain API (includes token management)
 */

import type { McpApp, McpAppsManagerResult } from "../../mcp-app-types";
import type { TokenServerAccess } from "../../token-types";

interface Token {
  id: string;
  name: string;
  createdAt: Date;
  lastUsed?: Date;
}

interface TokenGenerateOptions {
  name: string;
  expiresIn?: number;
}

export interface AppAPI {
  // App management
  list(): Promise<McpApp[]>;
  create(appName: string): Promise<McpAppsManagerResult>;
  delete(appName: string): Promise<boolean>;
  updateServerAccess(
    appName: string,
    serverAccess: TokenServerAccess,
  ): Promise<McpAppsManagerResult>;
  unifyConfig(appName: string): Promise<McpAppsManagerResult>;

  // Token management
  tokens: {
    generate(options: TokenGenerateOptions): Promise<string>;
    revoke(tokenId: string): Promise<void>;
    list(): Promise<Token[]>;
  };
}
