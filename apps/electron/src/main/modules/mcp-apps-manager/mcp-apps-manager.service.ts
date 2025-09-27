import path from "path";
import { promises as fsPromises } from "fs";
import { getServerService } from "@/main/modules/mcp-server-manager/server-service";
import { SingletonService } from "@/main/modules/singleton-service";
import {
  syncServersFromClientConfig,
  extractConfigInfo,
} from "./mcp-config-importer";
import {
  Token,
  TokenGenerateOptions,
  TokenValidationResult,
  McpApp,
  McpAppsManagerResult,
  McpRouterConfig,
  StandardAppConfig,
  VSCodeAppConfig,
  MCPServerConfig,
  MCPConnectionResult,
  MCPInputParam,
} from "@mcp_router/shared";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

// Internal modules
import { TokenManager } from "./token-manager";
import { MCPClient } from "./mcp-client";
import { AppPaths } from "./app-paths";

// SVGアイコンのインポート
import claudeIcon from "../../../../public/images/apps/claude.svg";
import clineIcon from "../../../../public/images/apps/cline.svg";
import windsurfIcon from "../../../../public/images/apps/windsurf.svg";
import cursorIcon from "../../../../public/images/apps/cursor.svg";
import vscodeIcon from "../../../../public/images/apps/vscode.svg";

// アイコンのマッピング
const ICON_MAP: Record<string, string> = {
  claude: claudeIcon,
  cline: clineIcon,
  windsurf: windsurfIcon,
  cursor: cursorIcon,
  vscode: vscodeIcon,
};

// 標準アプリの定義
const STANDARD_APPS = [
  {
    id: "claude",
    name: "Claude",
    configPathFn: () => "claudeConfig",
    icon: "claude",
  },
  {
    id: "cline",
    name: "Cline",
    configPathFn: () => "clineConfig",
    icon: "cline",
  },
  {
    id: "windsurf",
    name: "Windsurf",
    configPathFn: () => "windsurfConfig",
    icon: "windsurf",
  },
  {
    id: "cursor",
    name: "Cursor",
    configPathFn: () => "cursorConfig",
    icon: "cursor",
  },
  {
    id: "vscode",
    name: "VSCode",
    configPathFn: () => "vscodeConfig",
    icon: "vscode",
  },
];

/**
 * MCP Apps Service - 統合されたMCPアプリケーション管理サービス
 * アプリケーション設定、トークン管理、クライアントユーティリティを統合
 */
export class McpAppsManagerService extends SingletonService<
  Token,
  string,
  McpAppsManagerService
> {
  private tokenManager: TokenManager;
  private mcpClient: MCPClient;
  private appPaths: AppPaths;

  /**
   * Constructor
   */
  protected constructor() {
    super();
    this.tokenManager = new TokenManager();
    this.mcpClient = new MCPClient();
    this.appPaths = new AppPaths();
  }

  /**
   * Get entity name
   */
  protected getEntityName(): string {
    return "McpApps";
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): McpAppsManagerService {
    return (this as any).getInstanceBase();
  }

  /**
   * Reset instance
   * Note: Tokens are shared across workspaces, so we don't reset them
   */
  public static resetInstance(): void {
    // トークンはワークスペース間で共有されるため、リセットしない
    console.log(
      "[McpAppsService] Skip reset - tokens are shared across workspaces",
    );
  }

  // ========== Token Service Methods (delegated to TokenManager) ==========

  public generateToken(options: TokenGenerateOptions): Token {
    try {
      return this.tokenManager.generateToken(options);
    } catch (error) {
      return this.handleError("トークン生成", error);
    }
  }

  public validateToken(tokenId: string): TokenValidationResult {
    try {
      return this.tokenManager.validateToken(tokenId);
    } catch (error) {
      return this.handleError("トークン検証", error, {
        isValid: false,
        error: `検証中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  public getClientIdFromToken(tokenId: string): string | null {
    try {
      return this.tokenManager.getClientIdFromToken(tokenId);
    } catch (error) {
      this.handleError("クライアントID取得", error);
      return null;
    }
  }

  public deleteToken(tokenId: string): boolean {
    try {
      return this.tokenManager.deleteToken(tokenId);
    } catch (error) {
      return this.handleError(`ID:${tokenId}の削除`, error, false);
    }
  }

  public deleteClientTokens(clientId: string): number {
    try {
      return this.tokenManager.deleteClientTokens(clientId);
    } catch (error) {
      return this.handleError(
        `クライアント${clientId}のトークン削除`,
        error,
        0,
      );
    }
  }

  public listTokens(): Token[] {
    try {
      return this.tokenManager.listTokens();
    } catch (error) {
      return this.handleError("一覧取得", error, []);
    }
  }

  public hasServerAccess(tokenId: string, serverId: string): boolean {
    try {
      return this.tokenManager.hasServerAccess(tokenId, serverId);
    } catch (error) {
      return this.handleError("サーバアクセス権限確認", error, false);
    }
  }

  public updateTokenServerAccess(
    tokenId: string,
    serverIds: string[],
  ): boolean {
    try {
      return this.tokenManager.updateTokenServerAccess(tokenId, serverIds);
    } catch (error) {
      return this.handleError("サーバアクセス権限更新", error, false);
    }
  }

  // ========== Client Utilities (delegated to MCPClient) ==========

  public async connectToMCPServer(
    server: MCPServerConfig,
    clientName = "mcp-client",
  ): Promise<MCPConnectionResult> {
    return this.mcpClient.connectToMCPServer(server, clientName);
  }

  public async fetchServerTools(client: Client): Promise<any[]> {
    return this.mcpClient.fetchServerTools(client);
  }

  public async fetchServerResources(client: Client): Promise<any[]> {
    return this.mcpClient.fetchServerResources(client);
  }

  public async readServerResource(
    client: Client,
    resourceUri: string,
  ): Promise<any> {
    return this.mcpClient.readServerResource(client, resourceUri);
  }

  public substituteArgsParameters(
    argsTemplate: string[],
    env: Record<string, string>,
    inputParams: Record<string, MCPInputParam>,
  ): string[] {
    return this.mcpClient.substituteArgsParameters(
      argsTemplate,
      env,
      inputParams,
    );
  }

  // ========== App Path Methods (delegated to AppPaths) ==========

  public async exists(filePath: string): Promise<boolean> {
    return this.appPaths.exists(filePath);
  }

  // ========== App Management Methods ==========

  /**
   * アプリの設定ファイルパスを取得
   */
  private getAppConfigPath(name: string): string {
    const standardApp = STANDARD_APPS.find(
      (app) => app.id.toLowerCase() === name.toLowerCase(),
    );
    if (!standardApp) return "";

    const methodName = standardApp.configPathFn();
    switch (methodName) {
      case "claudeConfig":
        return this.appPaths.claudeConfig();
      case "clineConfig":
        return this.appPaths.clineConfig();
      case "windsurfConfig":
        return this.appPaths.windsurfConfig();
      case "cursorConfig":
        return this.appPaths.cursorConfig();
      case "vscodeConfig":
        return this.appPaths.vscodeConfig();
      default:
        return "";
    }
  }

  /**
   * 標準アプリかどうかを判定
   */
  private isStandardApp(name: string): boolean {
    return STANDARD_APPS.some(
      (app) =>
        app.id.toLowerCase() === name.toLowerCase() ||
        app.name.toLowerCase() === name.toLowerCase(),
    );
  }

  /**
   * 標準アプリのアイコンを取得
   */
  private getStandardAppIcon(name: string): string | undefined {
    const standardApp = STANDARD_APPS.find(
      (app) =>
        app.id.toLowerCase() === name.toLowerCase() ||
        app.name.toLowerCase() === name.toLowerCase(),
    );
    if (standardApp?.icon) {
      return ICON_MAP[standardApp.icon];
    }
    return undefined;
  }

  /**
   * VSCodeアプリかどうかを判定
   */
  private isVSCodeApp(name: string): boolean {
    return name.toLowerCase() === "vscode";
  }

  /**
   * トークンを使用してMCP Routerの設定を生成
   */
  private createMcpRouterConfig(tokenId: string): McpRouterConfig {
    return {
      command: "npx",
      args: ["-y", "@mcp_router/cli@latest", "connect"],
      env: {
        MCPR_TOKEN: tokenId,
      },
    };
  }

  /**
   * VSCode用の設定オブジェクトを生成
   */
  private createVSCodeConfig(
    tokenId: string,
    existingConfig: any = {},
  ): VSCodeAppConfig {
    const config = { ...existingConfig };
    if (!config.mcp) config.mcp = {};

    // mcp.serversオブジェクトを作成・更新
    // 既存のserversを保持しながらmcp-routerを追加/更新
    if (!config.mcp.servers) {
      config.mcp.servers = {};
    }
    config.mcp.servers["mcp-router"] = this.createMcpRouterConfig(tokenId);

    return config;
  }

  /**
   * 標準アプリ用の設定オブジェクトを生成
   */
  private createStandardAppConfig(
    tokenId: string,
    existingConfig: any = {},
  ): StandardAppConfig {
    const config = { ...existingConfig };

    // mcpServersオブジェクトを作成・更新
    config.mcpServers = {
      "mcp-router": this.createMcpRouterConfig(tokenId),
    };

    return config;
  }

  /**
   * 設定ファイルを読み込む
   */
  private async readConfigFile(configPath: string): Promise<any> {
    try {
      const fileContent = await fsPromises.readFile(configPath, "utf8");
      return JSON.parse(fileContent);
    } catch (error) {
      console.log(`Failed to read config file: ${configPath}`, error);
      return {};
    }
  }

  /**
   * 設定ファイルを保存
   */
  private async saveConfigFile(configPath: string, config: any): Promise<void> {
    await fsPromises.writeFile(
      configPath,
      JSON.stringify(config, null, 2),
      "utf8",
    );
  }

  /**
   * アプリ用の設定を更新
   */
  private async updateAppConfig(
    appName: string,
    configPath: string,
    tokenId: string,
  ): Promise<void> {
    // アプリがインストールされているか確認
    const installed = await this.exists(configPath);
    if (!installed) {
      const configDir = path.dirname(configPath);
      await fsPromises.mkdir(configDir, { recursive: true });
    }

    // 既存の設定を読み込む
    let config = installed ? await this.readConfigFile(configPath) : {};

    // VSCodeとClaude Codeとその他のアプリで異なる設定構造を処理
    if (this.isVSCodeApp(appName)) {
      config = this.createVSCodeConfig(tokenId, config);
    } else {
      config = this.createStandardAppConfig(tokenId, config);
    }

    // 設定ファイルを保存
    await this.saveConfigFile(configPath, config);
  }

  /**
   * 追加アプリ一覧を取得
   */
  private async getAdditionalApps(): Promise<McpApp[]> {
    try {
      const tokens = this.listTokens();

      // 標準アプリでないトークンだけをフィルタリング
      const standardAppIds = STANDARD_APPS.map((app) => app.id.toLowerCase());

      const additionalAppTokens = tokens.filter(
        (token) => !standardAppIds.includes(token.clientId),
      );

      // トークンからアプリ情報を生成
      return Promise.all(
        additionalAppTokens.map(async (token) => {
          const appName = token.clientId;

          return {
            name: appName,
            installed: true,
            configPath: "",
            configured: true,
            token: token.id,
            serverIds: token.serverIds,
            isCustom: true,
            icon: undefined,
          };
        }),
      );
    } catch (error) {
      console.error("Failed to get additional apps:", error);
      return [];
    }
  }

  /**
   * アプリ情報を取得
   */
  private async getAppInfo(
    appName: string,
    token: { id: string; serverIds: string[] },
    isStdApp: boolean,
  ): Promise<McpApp> {
    if (isStdApp) {
      // 標準アプリの処理
      const configPath = this.getAppConfigPath(appName);

      // アプリの設定を更新
      await this.updateAppConfig(appName, configPath, token.id);

      // アプリの状態をチェック
      return this.checkApp(appName, configPath, token.id, token.serverIds);
    } else {
      // カスタムアプリの処理

      return {
        name: appName,
        installed: true,
        configPath: "", // カスタムアプリの場合は空文字列
        configured: true,
        token: token.id,
        serverIds: token.serverIds,
        isCustom: true,
        icon: undefined,
      };
    }
  }

  /**
   * Check a specific app's installation and configuration status
   */
  private async checkApp(
    name: string,
    configPath: string,
    knownToken?: string,
    knownServerIds?: string[],
  ): Promise<McpApp> {
    try {
      // トークン関連情報の取得
      const allTokens = this.listTokens();
      const appTokens = allTokens.filter(
        (token) =>
          token.clientId.toLowerCase() === name.toLowerCase() ||
          token.clientId.toLowerCase().startsWith(name.toLowerCase() + "-"),
      );

      const installed = await this.exists(configPath);
      let configured = false;
      let token: string = knownToken || "";
      let serverIds: string[] = knownServerIds || [];
      let isCustom = false;
      let hasOtherServers = false;

      // アプリトークンから取得
      if (!token && appTokens.length > 0) {
        token = appTokens[0].id;
        serverIds = appTokens[0].serverIds || serverIds;
      }

      // トークンの有効性チェックと設定状態の判定
      if (token) {
        const tokenValid = allTokens.some((t) => t.id === token);

        if (!tokenValid) {
          configured = false;
          token = "";
        } else if (isCustom) {
          // カスタムアプリは設定ファイル不要
          configured = true;
        } else if (installed) {
          // 標準アプリの場合、設定ファイルを確認
          const { hasMcpConfig, configToken, otherServers } =
            await extractConfigInfo(name, configPath);
          const configTokenValid =
            configToken && allTokens.some((t) => t.id === configToken);

          configured = !!(hasMcpConfig && configTokenValid);

          // 有効なトークンなら使用
          if (configTokenValid) {
            token = configToken;
          }

          // 他のMCPサーバが設定されているか確認
          hasOtherServers = !!(otherServers && otherServers.length > 0);

          // 他のMCPサーバが設定されていたら同期する
          if (hasOtherServers) {
            await syncServersFromClientConfig(otherServers || []);
          }
        }
      }

      // トークンからserverIdsを取得
      if (token) {
        const tokenObj = allTokens.find((t) => t.id === token);
        if (tokenObj) {
          // serverIdsがまだ空の場合、トークンから取得
          if (!serverIds.length) {
            serverIds = tokenObj.serverIds || [];
          }
        }
      }

      return {
        name,
        installed,
        configPath,
        configured,
        token,
        serverIds,
        isCustom,
        hasOtherServers,
        icon: this.getStandardAppIcon(name),
      };
    } catch (_) {
      return {
        name,
        installed: false,
        configPath,
        configured: false,
        icon: this.getStandardAppIcon(name),
      };
    }
  }

  // ========== Public App Management Methods ==========

  /**
   * List all supported apps with their installation and configuration status
   */
  public async listMcpApps(): Promise<McpApp[]> {
    // 標準アプリ
    const standardApps = await Promise.all(
      STANDARD_APPS.map((app) => {
        const configPath = this.getAppConfigPath(app.name);
        return this.checkApp(app.name, configPath);
      }),
    );

    // 追加アプリを取得して結合
    const additionalApps = await this.getAdditionalApps();

    return [...standardApps, ...additionalApps];
  }

  /**
   * アプリを追加（標準アプリとカスタムアプリの両方に対応）
   */
  public async addApp(name: string): Promise<McpAppsManagerResult> {
    try {
      // 名前が空でないことを確認
      if (!name || name.trim() === "") {
        return {
          success: false,
          message: "App name cannot be empty",
        };
      }

      const isStdApp = this.isStandardApp(name);

      // 標準アプリではない場合は既存のアプリと名前の重複をチェック
      if (!isStdApp) {
        // 既存の追加アプリを取得
        const customApps = await this.getAdditionalApps();

        // 既に同名のアプリが存在するかチェック
        if (
          customApps.some(
            (app) => app.name.toLowerCase() === name.toLowerCase(),
          )
        ) {
          return {
            success: false,
            message: `An app with the name "${name}" already exists`,
          };
        }
      }

      // トークンを生成
      const serverService = getServerService();
      const servers = serverService.getAllServers();
      const serverIds = servers.map((server: { id: string }) => server.id);

      const token = this.generateToken({
        clientId: `${name.toLowerCase()}`,
        serverIds: serverIds,
      });

      // アプリ情報を取得
      const app = await this.getAppInfo(name, token, isStdApp);

      return {
        success: true,
        message: `Successfully added ${isStdApp ? "MCP configuration to" : "app"} "${name}" with token`,
        app,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to add app: ${error.message}`,
      };
    }
  }

  /**
   * アプリのサーバアクセス権限を更新
   */
  public async updateAppServerAccess(
    appName: string,
    serverIds: string[],
  ): Promise<McpAppsManagerResult> {
    try {
      const allTokens = this.listTokens();

      // アプリに対応するクライアントID
      const clientId = appName.toLowerCase();

      // アプリに対応するトークンを検索
      const appToken = allTokens.find((token) => token.clientId === clientId);

      if (!appToken) {
        return {
          success: false,
          message: `No token found for app "${appName}".`,
        };
      }

      // トークンのサーバアクセス権限を更新
      const success = this.updateTokenServerAccess(appToken.id, serverIds);

      if (!success) {
        return {
          success: false,
          message: `Failed to update server access for "${appName}"`,
        };
      }

      // 標準アプリかどうかを判定
      const isStdApp = this.isStandardApp(appName);

      // アプリ情報を取得
      const tokenInfo = { id: appToken.id, serverIds };
      const app = await this.getAppInfo(appName, tokenInfo, isStdApp);

      return {
        success: true,
        message: `Successfully updated server access for "${appName}"`,
        app,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to update server access: ${error.message}`,
      };
    }
  }

  /**
   * カスタムアプリを削除する
   */
  public async deleteCustomApp(appName: string): Promise<boolean> {
    try {
      // カスタムアプリであることを確認
      if (this.isStandardApp(appName)) {
        return false;
      }

      const clientId = appName.toLowerCase();

      // トークンが存在するか確認
      const appTokens = this.listTokens().filter(
        (token) => token.clientId === clientId,
      );

      if (appTokens.length === 0) {
        return false;
      }

      // クライアントIDに関連するすべてのトークンを削除
      const deletedCount = this.deleteClientTokens(clientId);

      return deletedCount > 0;
    } catch (error: any) {
      console.error(`Failed to delete custom app ${appName}:`, error);
      return false;
    }
  }

  /**
   * アプリの設定を統一（他のMCPサーバ設定を削除）
   */
  public async unifyAppConfig(appName: string): Promise<McpAppsManagerResult> {
    try {
      // 標準アプリかどうかを確認
      const isStdApp = this.isStandardApp(appName);

      // カスタムアプリの場合は処理が不要
      if (!isStdApp) {
        return {
          success: false,
          message: `Custom apps don't need unified configuration.`,
        };
      }

      // 設定ファイルのパスを取得
      const configPath = this.getAppConfigPath(appName);

      // アプリがインストールされているか確認
      const installed = await this.exists(configPath);
      if (!installed) {
        return {
          success: false,
          message: `App "${appName}" is not installed.`,
        };
      }

      // トークンサービスからアプリのトークンを取得
      const allTokens = this.listTokens();

      // アプリに対応するクライアントID
      const clientId = appName.toLowerCase();

      // アプリに対応するトークンを検索
      const appToken = allTokens.find((token) => token.clientId === clientId);

      if (!appToken) {
        return {
          success: false,
          message: `No token found for app "${appName}".`,
        };
      }

      // アプリの設定を更新して他のMCPサーバ設定を削除
      await this.updateAppConfig(appName, configPath, appToken.id);

      // 更新されたアプリ情報を取得
      const app = await this.checkApp(
        appName,
        configPath,
        appToken.id,
        appToken.serverIds,
      );

      return {
        success: true,
        message: `Successfully unified configuration for "${appName}"`,
        app,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to unify configuration: ${error.message}`,
      };
    }
  }
}

/**
 * Get McpAppsService instance
 */
export function getMcpAppsService(): McpAppsManagerService {
  return McpAppsManagerService.getInstance();
}

// ========== Exported standalone functions for backward compatibility ==========

export async function listMcpApps(): Promise<McpApp[]> {
  return getMcpAppsService().listMcpApps();
}

export async function addApp(name: string): Promise<McpAppsManagerResult> {
  return getMcpAppsService().addApp(name);
}

export async function updateAppServerAccess(
  appName: string,
  serverIds: string[],
): Promise<McpAppsManagerResult> {
  return getMcpAppsService().updateAppServerAccess(appName, serverIds);
}

export async function deleteCustomApp(appName: string): Promise<boolean> {
  return getMcpAppsService().deleteCustomApp(appName);
}

export async function unifyAppConfig(
  appName: string,
): Promise<McpAppsManagerResult> {
  return getMcpAppsService().unifyAppConfig(appName);
}

// Client utility exports
export async function connectToMCPServer(
  server: MCPServerConfig,
  clientName = "mcp-client",
): Promise<MCPConnectionResult> {
  return getMcpAppsService().connectToMCPServer(server, clientName);
}

export async function fetchServerTools(client: Client): Promise<any[]> {
  return getMcpAppsService().fetchServerTools(client);
}

export async function fetchServerResources(client: Client): Promise<any[]> {
  return getMcpAppsService().fetchServerResources(client);
}

export async function readServerResource(
  client: Client,
  resourceUri: string,
): Promise<any> {
  return getMcpAppsService().readServerResource(client, resourceUri);
}

export function substituteArgsParameters(
  argsTemplate: string[],
  env: Record<string, string>,
  inputParams: Record<string, MCPInputParam>,
): string[] {
  return getMcpAppsService().substituteArgsParameters(
    argsTemplate,
    env,
    inputParams,
  );
}

// App path exports for mcp-config-importer
export function claudeConfig(): string {
  const appPaths = new AppPaths();
  return appPaths.claudeConfig();
}

export function clineConfig(): string {
  const appPaths = new AppPaths();
  return appPaths.clineConfig();
}

export function windsurfConfig(): string {
  const appPaths = new AppPaths();
  return appPaths.windsurfConfig();
}

export function cursorConfig(projectDir = ""): string {
  const appPaths = new AppPaths();
  return appPaths.cursorConfig(projectDir);
}

export function vscodeConfig(): string {
  const appPaths = new AppPaths();
  return appPaths.vscodeConfig();
}

export async function exists(filePath: string): Promise<boolean> {
  const appPaths = new AppPaths();
  return appPaths.exists(filePath);
}
