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
  TokenServerAccess,
} from "@mcp_router/shared";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

// Internal modules
import { TokenManager } from "./token-manager";
import { MCPClient } from "./mcp-client";
import { AppPaths } from "./app-paths";
import {
  STANDARD_APP_DEFINITIONS,
  findStandardAppDefinition,
  getStandardAppIds,
} from "./app-definitions";
import os from "os";

// SVGアイコンのインポート
import claudeIcon from "../../../../public/images/apps/claude.svg";
import clineIcon from "../../../../public/images/apps/cline.svg";
import windsurfIcon from "../../../../public/images/apps/windsurf.svg";
import cursorIcon from "../../../../public/images/apps/cursor.svg";
import vscodeIcon from "../../../../public/images/apps/vscode.svg";
import openAiIcon from "../../../../public/images/apps/openai.svg";
import antigravityIcon from "../../../../public/images/apps/antigravity.svg";
import githubIcon from "../../../../public/images/apps/github.svg";
import opencodeIcon from "../../../../public/images/apps/opencode.svg";
import googleIcon from "../../../../public/images/apps/google.svg";
import geminiIcon from "../../../../public/images/apps/gemini.svg";
import traeIcon from "../../../../public/images/apps/trae.svg";
import roocodeIcon from "../../../../public/images/apps/roocode.svg";
import gooseIcon from "../../../../public/images/apps/goose.svg";
import continueIcon from "../../../../public/images/apps/continue.svg";
import factoryIcon from "../../../../public/images/apps/factory.svg";

// アイコンのマッピング
const ICON_MAP: Record<string, string> = {
  claude: claudeIcon,
  cline: clineIcon,
  windsurf: `<svg width="24" height="24" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M897.246 286.869H889.819C850.735 286.808 819.017 318.46 819.017 357.539V515.589C819.017 547.15 792.93 572.716 761.882 572.716C743.436 572.716 725.02 563.433 714.093 547.85L552.673 317.304C539.28 298.16 517.486 286.747 493.895 286.747C457.094 286.747 423.976 318.034 423.976 356.657V515.619C423.976 547.181 398.103 572.746 366.842 572.746C348.335 572.746 329.949 563.463 319.021 547.881L138.395 289.882C134.316 284.038 125.154 286.93 125.154 294.052V431.892C125.154 438.862 127.285 445.619 131.272 451.34L309.037 705.2C319.539 720.204 335.033 731.344 352.9 735.392C397.616 745.557 438.77 711.135 438.77 667.278V508.406C438.77 476.845 464.339 451.279 495.904 451.279H495.995C515.02 451.279 532.857 460.562 543.785 476.145L705.235 706.661C718.659 725.835 739.327 737.218 763.983 737.218C801.606 737.218 833.841 705.9 833.841 667.308V508.376C833.841 476.815 859.41 451.249 890.975 451.249H897.276C901.233 451.249 904.43 448.053 904.43 444.097V294.021C904.43 290.065 901.233 286.869 897.276 286.869H897.246Z" fill="currentColor"/></svg>`,
  cursor: `<svg height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><title>Cursor</title><path d="M11.925 24l10.425-6-10.425-6L1.5 18l10.425 6z" fill="currentColor" fill-opacity="0.6"></path><path d="M22.35 18V6L11.925 0v12l10.425 6z" fill="currentColor" fill-opacity="0.4"></path><path d="M11.925 0L1.5 6v12l10.425-6V0z" fill="currentColor" fill-opacity="0.8"></path><path d="M22.35 6L11.925 24V12L22.35 6z" fill="currentColor" fill-opacity="0.2"></path><path d="M22.35 6l-10.425 6L1.5 6h20.85z" fill="currentColor"></path></svg>`,
  vscode: vscodeIcon,
  openai: `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" fill-rule="evenodd" clip-rule="evenodd" stroke-linejoin="round" stroke-miterlimit="2"><path d="M474.123 209.81c11.525-34.577 7.569-72.423-10.838-103.904-27.696-48.168-83.433-72.94-137.794-61.414a127.14 127.14 0 00-95.475-42.49c-55.564 0-104.936 35.781-122.139 88.593-35.781 7.397-66.574 29.76-84.637 61.414-27.868 48.167-21.503 108.72 15.826 150.007-11.525 34.578-7.569 72.424 10.838 103.733 27.696 48.34 83.433 73.111 137.966 61.585 24.084 27.18 58.833 42.835 95.303 42.663 55.564 0 104.936-35.782 122.139-88.594 35.782-7.397 66.574-29.76 84.465-61.413 28.04-48.168 21.676-108.722-15.654-150.008v-.172zm-39.567-87.218c11.01 19.267 15.139 41.803 11.354 63.65-.688-.516-2.064-1.204-2.924-1.72l-101.152-58.49a16.965 16.965 0 00-16.687 0L206.621 194.5v-50.232l97.883-56.597c45.587-26.32 103.732-10.666 130.052 34.921zm-227.935 104.42l49.888-28.9 49.887 28.9v57.63l-49.887 28.9-49.888-28.9v-57.63zm23.223-191.81c22.364 0 43.867 7.742 61.07 22.02-.688.344-2.064 1.204-3.097 1.72L186.666 117.26c-5.161 2.925-8.258 8.43-8.258 14.45v136.934l-43.523-25.116V130.333c0-52.64 42.491-95.13 95.131-95.302l-.172.172zM52.14 168.697c11.182-19.268 28.557-34.062 49.544-41.803V247.14c0 6.02 3.097 11.354 8.258 14.45l118.354 68.295-43.695 25.288-97.711-56.425c-45.415-26.32-61.07-84.465-34.75-130.052zm26.665 220.71c-11.182-19.095-15.139-41.802-11.354-63.65.688.516 2.064 1.204 2.924 1.72l101.152 58.49a16.965 16.965 0 0016.687 0l118.354-68.467v50.232l-97.883 56.425c-45.587 26.148-103.732 10.665-130.052-34.75h.172zm204.54 87.39c-22.192 0-43.867-7.741-60.898-22.02a62.439 62.439 0 003.097-1.72l101.152-58.317c5.16-2.924 8.429-8.43 8.257-14.45V243.527l43.523 25.116v113.022c0 52.64-42.663 95.303-95.131 95.303v-.172zM461.22 343.303c-11.182 19.267-28.729 34.061-49.544 41.63V264.687c0-6.021-3.097-11.526-8.257-14.45L284.893 181.77l43.523-25.116 97.883 56.424c45.587 26.32 61.07 84.466 34.75 130.053l.172.172z" fill="currentColor" fill-rule="nonzero"/></svg>`,
  antigravity: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M5 90 C 5 90, 15 95, 25 85 C 35 75, 40 20, 50 20 C 60 20, 65 75, 75 85 C 85 95, 95 90, 95 90 C 95 90, 80 70, 75 60 C 65 40, 60 35, 50 35 C 40 35, 35 40, 25 60 C 20 70, 5 90, 5 90 Z" fill="currentColor" /></svg>`,
  trae: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  roocode: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9h10v2H7z" fill="currentColor"/></svg>`,
  goose: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zm0 18c4.41 0 8-3.59 8-8s-3.59-8-8-8-8 3.59-8 8 3.59 8 8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" fill="currentColor"/></svg>`,
  factory: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

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
    serverAccess: TokenServerAccess,
  ): boolean {
    try {
      return this.tokenManager.updateTokenServerAccess(tokenId, serverAccess);
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
    const definition = findStandardAppDefinition(name);
    if (!definition) return "";
    return definition.getConfigPath(this.appPaths);
  }

  /**
   * 標準アプリかどうかを判定
   */
  private isStandardApp(name: string): boolean {
    return !!findStandardAppDefinition(name);
  }

  /**
   * 標準アプリのアイコンを取得
   */
  private getStandardAppIcon(name: string): string | undefined {
    const definition = findStandardAppDefinition(name);
    if (definition?.iconKey) {
      return ICON_MAP[definition.iconKey];
    }
    return undefined;
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
    if (!config.servers) {
      config.servers = {};
    }
    config.servers["mcp-router"] = this.createMcpRouterConfig(tokenId);

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
   * Codex 用 TOML 設定を更新/作成
   * 生成フォーマット:
   * [mcp_servers.mcp_router]
   * command = "npx"
   * args    = ["-y", "@mcp_router/cli@latest"]
   *
   * [mcp_servers.mcp_router.env]
   * MCPR_TOKEN = "<token>"
   */
  private async updateCodexConfigToml(
    filePath: string,
    tokenId: string,
  ): Promise<void> {
    const dir = path.dirname(filePath);
    await fsPromises.mkdir(dir, { recursive: true });

    const isWindows = process.platform === "win32";
    const command = isWindows
      ? "C:\\\\Program Files\\\\nodejs\\\\npx.cmd"
      : "npx";
    const localAppData = isWindows
      ? path.join(os.homedir(), "AppData", "Local")
      : null;
    const escapedLocalAppData = localAppData?.replace(/\\/g, "\\\\");

    const blockMain =
      `[mcp_servers.mcp_router]\n` +
      `command = "${command}"\n` +
      `args    = ["-y", "@mcp_router/cli@latest", "connect"]\n` +
      `startup_timeout_sec = 120\n`;
    let blockEnv =
      `\n[mcp_servers.mcp_router.env]\n` + `MCPR_TOKEN = "${tokenId}"\n`;
    if (escapedLocalAppData) {
      blockEnv += `LOCALAPPDATA = "${escapedLocalAppData}"\n`;
    }
    const newBlock = `${blockMain}${blockEnv}`;

    let content = "";
    try {
      content = await fsPromises.readFile(filePath, "utf8");
    } catch {
      // no file yet
    }

    if (content) {
      const blockPattern =
        /\[mcp_servers\.mcp_router\][\s\S]*?(?:\n\[mcp_servers\.mcp_router\.env\][\s\S]*?)?(?=\n\[[^\n]+\]|$)/g;
      let replaced = false;
      content = content.replace(blockPattern, () => {
        if (replaced) {
          return "";
        }
        replaced = true;
        return newBlock;
      });

      if (!replaced) {
        content = content.trimEnd();
        if (content.length > 0 && !content.endsWith("\n")) {
          content += "\n";
        }
        content += `\n${newBlock}`;
      } else {
        content = content.replace(/\n{3,}/g, "\n\n").trimEnd();
        if (!content.endsWith("\n")) {
          content += "\n";
        }
      }
    } else {
      content = newBlock;
    }

    await fsPromises.writeFile(filePath, content, "utf8");
  }

  /**
   * アプリ用の設定を更新
   */
  private async updateAppConfig(
    appName: string,
    configPath: string,
    tokenId: string,
  ): Promise<void> {
    const definition = findStandardAppDefinition(appName);
    if (!definition) {
      return;
    }

    // Codex uses TOML and a different structure; write in TOML
    if (definition.configKind === "codex") {
      await this.updateCodexConfigToml(configPath, tokenId);
      return;
    }
    // アプリがインストールされているか確認
    const installed = await this.exists(configPath);
    if (!installed) {
      const configDir = path.dirname(configPath);
      await fsPromises.mkdir(configDir, { recursive: true });
    }

    // 既存の設定を読み込む
    let config = installed ? await this.readConfigFile(configPath) : {};

    // VSCodeとその他のアプリで異なる設定構造を処理
    if (definition.configKind === "vscode-json") {
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
      const standardAppIds = getStandardAppIds().map((id) => id.toLowerCase());

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
            serverAccess: token.serverAccess,
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
    token: { id: string; serverAccess: TokenServerAccess },
    isStdApp: boolean,
  ): Promise<McpApp> {
    if (isStdApp) {
      // 標準アプリの処理
      const configPath = this.getAppConfigPath(appName);

      // アプリの設定を更新
      await this.updateAppConfig(appName, configPath, token.id);

      // アプリの状態をチェック
      return this.checkApp(appName, configPath, token.id, token.serverAccess);
    } else {
      // カスタムアプリの処理

      return {
        name: appName,
        installed: true,
        configPath: "", // カスタムアプリの場合は空文字列
        configured: true,
        token: token.id,
        serverAccess: token.serverAccess,
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
    knownServerAccess?: TokenServerAccess,
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
      let serverAccess: TokenServerAccess | undefined = knownServerAccess;
      let isCustom = false;
      let hasOtherServers = false;

      // アプリトークンから取得
      if (!token && appTokens.length > 0) {
        token = appTokens[0].id;
        serverAccess = appTokens[0].serverAccess;
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

      // トークンからサーバーアクセスを取得
      if (token) {
        const tokenObj = allTokens.find((t) => t.id === token);
        if (tokenObj) {
          // サーバーアクセスがまだ空の場合、トークンから取得
          if (!serverAccess) {
            serverAccess = tokenObj.serverAccess;
          }
        }
      }

      return {
        name,
        installed,
        configPath,
        configured,
        token,
        serverAccess,
        isCustom,
        hasOtherServers,
        icon: this.getStandardAppIcon(name),
      };
    } catch {
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
      STANDARD_APP_DEFINITIONS.map((definition) => {
        const configPath = definition.getConfigPath(this.appPaths);
        return this.checkApp(definition.name, configPath);
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
      const serverAccess: TokenServerAccess = {};
      servers.forEach((server: { id: string }) => {
        serverAccess[server.id] = true;
      });

      const token = this.generateToken({
        clientId: `${name.toLowerCase()}`,
        serverAccess,
      });

      // アプリ情報を取得
      const app = await this.getAppInfo(
        name,
        { id: token.id, serverAccess: token.serverAccess },
        isStdApp,
      );

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
    serverAccess: TokenServerAccess,
  ): Promise<McpAppsManagerResult> {
    try {
      const incomingAccess = serverAccess || {};
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
      const success = this.updateTokenServerAccess(appToken.id, incomingAccess);

      if (!success) {
        return {
          success: false,
          message: `Failed to update server access for "${appName}"`,
        };
      }

      // 標準アプリかどうかを判定
      const isStdApp = this.isStandardApp(appName);

      // アプリ情報を取得
      const refreshedToken =
        this.listTokens().find((token) => token.id === appToken.id) ||
        ({
          ...appToken,
          serverAccess: incomingAccess,
        } as Token);
      const tokenInfo = {
        id: refreshedToken.id,
        serverAccess: refreshedToken.serverAccess,
      };
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
        appToken.serverAccess,
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
  serverAccess: TokenServerAccess,
): Promise<McpAppsManagerResult> {
  return getMcpAppsService().updateAppServerAccess(appName, serverAccess);
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

export function codexConfig(): string {
  const appPaths = new AppPaths();
  return appPaths.codexConfig();
}

export async function exists(filePath: string): Promise<boolean> {
  const appPaths = new AppPaths();
  return appPaths.exists(filePath);
}
