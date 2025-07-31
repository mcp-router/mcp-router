import path from "path";
import { promises as fsPromises } from "fs";
import { app } from "electron";
import { getTokenService } from "../../../domain/mcp-core/token/token-service";
import { getServerService } from "../../../domain/mcp-core/server/server-service";
import {
  claudeConfig,
  clineConfig,
  windsurfConfig,
  cursorConfig,
  vscodeConfig,
  exists,
} from "@/main/domain/mcp-core/client/mcp-app-paths";
import {
  syncServersFromClientConfig,
  extractConfigInfo,
} from "./mcp-config-importer";
import {
  TokenScope,
  McpApp,
  McpAppsManagerResult,
  McpRouterConfig,
  StandardAppConfig,
  VSCodeAppConfig,
} from "@mcp_router/shared";

// 標準アプリの定義
const STANDARD_APPS = [
  { id: "claude", name: "Claude", configPathFn: claudeConfig, icon: "claude" },
  { id: "cline", name: "Cline", configPathFn: clineConfig, icon: "cline" },
  {
    id: "windsurf",
    name: "Windsurf",
    configPathFn: windsurfConfig,
    icon: "windsurf",
  },
  { id: "cursor", name: "Cursor", configPathFn: cursorConfig, icon: "cursor" },
  { id: "vscode", name: "VSCode", configPathFn: vscodeConfig, icon: "vscode" },
];

/**
 * アプリの設定ファイルパスを取得
 * 標準アプリの場合は専用のパスを返し、カスタムアプリの場合は空文字列を返す
 */
function getAppConfigPath(name: string): string {
  const standardApp = STANDARD_APPS.find(
    (app) => app.id.toLowerCase() === name.toLowerCase(),
  );
  return standardApp ? standardApp.configPathFn() : "";
}

/**
 * 標準アプリかどうかを判定
 */
function isStandardApp(name: string): boolean {
  return STANDARD_APPS.some(
    (app) =>
      app.id.toLowerCase() === name.toLowerCase() ||
      app.name.toLowerCase() === name.toLowerCase(),
  );
}

/**
 * アイコンSVGファイルを読み込む
 */
async function loadIconSvg(iconName: string): Promise<string | undefined> {
  try {
    const iconPath = path.join(
      app.getAppPath(),
      "public",
      "images",
      "apps",
      `${iconName}.svg`,
    );
    const svgContent = await fsPromises.readFile(iconPath, "utf8");
    return svgContent;
  } catch (error) {
    console.error(`Failed to load icon ${iconName}:`, error);
    return undefined;
  }
}

/**
 * 標準アプリのアイコンを取得
 */
async function getStandardAppIcon(name: string): Promise<string | undefined> {
  const standardApp = STANDARD_APPS.find(
    (app) =>
      app.id.toLowerCase() === name.toLowerCase() ||
      app.name.toLowerCase() === name.toLowerCase(),
  );
  if (standardApp?.icon) {
    return await loadIconSvg(standardApp.icon);
  }
  return undefined;
}

/**
 * VSCodeアプリかどうかを判定
 */
function isVSCodeApp(name: string): boolean {
  return name.toLowerCase() === "vscode";
}

/**
 * トークンを使用してMCP Routerの設定を生成
 */
function createMcpRouterConfig(tokenId: string): McpRouterConfig {
  return {
    command: "npx",
    args: ["-y", "mcpr-cli@latest", "connect"],
    env: {
      MCPR_TOKEN: tokenId,
    },
  };
}

/**
 * VSCode用の設定オブジェクトを生成
 */
function createVSCodeConfig(
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
  config.mcp.servers["mcp-router"] = createMcpRouterConfig(tokenId);

  return config;
}

/**
 * 標準アプリ用の設定オブジェクトを生成
 */
function createStandardAppConfig(
  tokenId: string,
  existingConfig: any = {},
): StandardAppConfig {
  const config = { ...existingConfig };

  // mcpServersオブジェクトを作成・更新
  config.mcpServers = {
    "mcp-router": createMcpRouterConfig(tokenId),
  };

  return config;
}

/**
 * 設定ファイルを読み込む
 * @returns {Promise<any>} 読み込まれた設定オブジェクトまたは空のオブジェクト
 */
async function readConfigFile(configPath: string): Promise<any> {
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
async function saveConfigFile(configPath: string, config: any): Promise<void> {
  await fsPromises.writeFile(
    configPath,
    JSON.stringify(config, null, 2),
    "utf8",
  );
}

/**
 * アプリ用の設定を更新
 */
async function updateAppConfig(
  appName: string,
  configPath: string,
  tokenId: string,
): Promise<void> {
  // アプリがインストールされているか確認
  const installed = await exists(configPath);
  if (!installed) {
    const configDir = path.dirname(configPath);
    await fsPromises.mkdir(configDir, { recursive: true });
  }

  // 既存の設定を読み込む
  let config = installed ? await readConfigFile(configPath) : {};

  // VSCodeとClaude Codeとその他のアプリで異なる設定構造を処理
  if (isVSCodeApp(appName)) {
    config = createVSCodeConfig(tokenId, config);
  } else {
    config = createStandardAppConfig(tokenId, config);
  }

  // 設定ファイルを保存
  await saveConfigFile(configPath, config);
}

/**
 * 追加アプリ一覧を取得
 */
async function getAdditionalApps(): Promise<McpApp[]> {
  try {
    const tokenService = getTokenService();
    const tokens = tokenService.listTokens();

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
          scopes: token.scopes || [],
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
 * 標準アプリとカスタムアプリの両方に対応
 */
async function getAppInfo(
  appName: string,
  token: { id: string; serverIds: string[] },
  isStdApp: boolean,
): Promise<McpApp> {
  if (isStdApp) {
    // 標準アプリの処理
    const configPath = getAppConfigPath(appName);

    // アプリの設定を更新
    await updateAppConfig(appName, configPath, token.id);

    // アプリの状態をチェック
    return checkApp(appName, configPath, token.id, token.serverIds);
  } else {
    // カスタムアプリの処理
    // トークンからスコープ情報を取得
    const tokenService = getTokenService();
    const tokenObj = tokenService.listTokens().find((t) => t.id === token.id);
    const scopes = tokenObj?.scopes || [];

    return {
      name: appName,
      installed: true,
      configPath: "", // カスタムアプリの場合は空文字列
      configured: true,
      token: token.id,
      serverIds: token.serverIds,
      isCustom: true,
      scopes,
      icon: undefined,
    };
  }
}

/**
 * List all supported apps with their installation and configuration status
 */
export async function listMcpApps(): Promise<McpApp[]> {
  // 標準アプリ
  const standardApps = await Promise.all(
    STANDARD_APPS.map((app) => checkApp(app.name, app.configPathFn())),
  );

  // 追加アプリを取得して結合
  const additionalApps = await getAdditionalApps();

  return [...standardApps, ...additionalApps];
}

/**
 * アプリを追加（標準アプリとカスタムアプリの両方に対応）
 */
export async function addApp(name: string): Promise<McpAppsManagerResult> {
  try {
    // 名前が空でないことを確認
    if (!name || name.trim() === "") {
      return {
        success: false,
        message: "App name cannot be empty",
      };
    }

    const isStdApp = isStandardApp(name);

    // 標準アプリではない場合は既存のアプリと名前の重複をチェック
    if (!isStdApp) {
      // 既存の追加アプリを取得
      const customApps = await getAdditionalApps();

      // 既に同名のアプリが存在するかチェック
      if (
        customApps.some((app) => app.name.toLowerCase() === name.toLowerCase())
      ) {
        return {
          success: false,
          message: `An app with the name "${name}" already exists`,
        };
      }
    }

    // トークンを生成
    const tokenService = getTokenService();
    const serverService = getServerService();
    const servers = serverService.getAllServers();
    const serverIds = servers.map((server: { id: string }) => server.id);

    const token = tokenService.generateToken({
      clientId: `${name.toLowerCase()}`,
      serverIds: serverIds,
    });

    // アプリ情報を取得
    const app = await getAppInfo(name, token, isStdApp);

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
export async function updateAppServerAccess(
  appName: string,
  serverIds: string[],
): Promise<McpAppsManagerResult> {
  try {
    const tokenService = getTokenService();
    const allTokens = tokenService.listTokens();

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
    const success = tokenService.updateTokenServerAccess(
      appToken.id,
      serverIds,
    );

    if (!success) {
      return {
        success: false,
        message: `Failed to update server access for "${appName}"`,
      };
    }

    // 標準アプリかどうかを判定
    const isStdApp = isStandardApp(appName);

    // アプリ情報を取得
    const tokenInfo = { id: appToken.id, serverIds };
    const app = await getAppInfo(appName, tokenInfo, isStdApp);

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
 * ログは保持される
 */
export async function deleteCustomApp(appName: string): Promise<boolean> {
  try {
    // カスタムアプリであることを確認
    if (isStandardApp(appName)) {
      return false;
    }

    // トークンサービスを取得
    const tokenService = getTokenService();
    const clientId = appName.toLowerCase();

    // トークンが存在するか確認
    const appTokens = tokenService
      .listTokens()
      .filter((token) => token.clientId === clientId);

    if (appTokens.length === 0) {
      return false;
    }

    // クライアントIDに関連するすべてのトークンを削除
    const deletedCount = tokenService.deleteClientTokens(clientId);

    return deletedCount > 0;
  } catch (error: any) {
    console.error(`Failed to delete custom app ${appName}:`, error);
    return false;
  }
}

/**
 * アプリの設定を統一（他のMCPサーバ設定を削除）
 */
export async function unifyAppConfig(
  appName: string,
): Promise<McpAppsManagerResult> {
  try {
    // 標準アプリかどうかを確認
    const isStdApp = isStandardApp(appName);

    // カスタムアプリの場合は処理が不要
    if (!isStdApp) {
      return {
        success: false,
        message: `Custom apps don't need unified configuration.`,
      };
    }

    // 設定ファイルのパスを取得
    const configPath = getAppConfigPath(appName);

    // アプリがインストールされているか確認
    const installed = await exists(configPath);
    if (!installed) {
      return {
        success: false,
        message: `App "${appName}" is not installed.`,
      };
    }

    // トークンサービスからアプリのトークンを取得
    const tokenService = getTokenService();
    const allTokens = tokenService.listTokens();

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
    await updateAppConfig(appName, configPath, appToken.id);

    // 更新されたアプリ情報を取得
    const app = await checkApp(
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

/**
 * Check a specific app's installation and configuration status
 */
async function checkApp(
  name: string,
  configPath: string,
  knownToken?: string,
  knownServerIds?: string[],
): Promise<McpApp> {
  try {
    // トークン関連情報の取得
    const tokenService = getTokenService();
    const allTokens = tokenService.listTokens();
    const appTokens = allTokens.filter(
      (token) =>
        token.clientId.toLowerCase() === name.toLowerCase() ||
        token.clientId.toLowerCase().startsWith(name.toLowerCase() + "-"),
    );

    const installed = await exists(configPath);
    let configured = false;
    let token: string = knownToken || "";
    let serverIds: string[] = knownServerIds || [];
    let isCustom = false;
    let hasOtherServers = false;

    // カスタムアプリ情報の取得
    // const customApps = await getAdditionalApps();
    // const customApp = customApps.find(
    //   (app) => app.name.toLowerCase() === name.toLowerCase(),
    // );
    // if (customApp) {
    //   token = token || customApp.token || "";
    //   serverIds = customApp.serverIds || serverIds;
    //   isCustom = true;
    // }

    // トークンがまだ不明な場合は、アプリトークンから取得
    let scopes: TokenScope[] = [];
    if (!token && appTokens.length > 0) {
      token = appTokens[0].id;
      serverIds = appTokens[0].serverIds || serverIds;
      scopes = appTokens[0].scopes || [];
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

    // トークンからスコープとserverIdsを取得
    if (token) {
      const tokenObj = allTokens.find((t) => t.id === token);
      if (tokenObj) {
        if (!scopes.length) {
          scopes = tokenObj.scopes || [];
        }
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
      scopes,
      icon: await getStandardAppIcon(name),
    };
  } catch (error) {
    return {
      name,
      installed: false,
      configPath,
      configured: false,
      scopes: [],
      icon: await getStandardAppIcon(name),
    };
  }
}
