import { TokenScope } from "./token-types";

export interface McpApp {
  name: string;
  installed: boolean;
  configPath: string;
  configured: boolean;
  token?: string; // アプリ用のトークン
  serverIds?: string[]; // アクセス可能なサーバIDs
  isCustom?: boolean; // カスタムアプリかどうか
  hasOtherServers?: boolean; // McpAppで、他のMCPサーバが設定されているかどうか（例：VSCodeで他のMCPサーバも設定されている）
  scopes: TokenScope[]; // トークンのスコープ
  icon?: string; // アプリのアイコン（SVGやBase64など）
}

export interface McpAppsManagerResult {
  success: boolean;
  message: string;
  app?: McpApp;
}

export interface PackageUpdateInfo {
  packageName: string;
  currentVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
}

export interface ServerPackageUpdates {
  packages: PackageUpdateInfo[];
  hasUpdates: boolean;
}
