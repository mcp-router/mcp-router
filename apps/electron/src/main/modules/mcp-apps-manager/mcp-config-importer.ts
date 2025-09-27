import { promises as fsPromises } from "fs";
import { getServerService } from "@/main/modules/mcp-server-manager/server-service";
import { MCPServerConfig, ClientType, ClientConfig } from "@mcp_router/shared";
import {
  claudeConfig,
  clineConfig,
  windsurfConfig,
  cursorConfig,
  vscodeConfig,
  exists,
} from "./mcp-apps-manager.service";
import { v4 as uuidv4 } from "uuid";
import { getSettingsService } from "@/main/modules/settings/settings.service";

/**
 * Sync server configurations from a provided list of configs
 * Used by the mcp-apps-service to sync servers found in client config files
 */
export async function syncServersFromClientConfig(
  serverConfigs: MCPServerConfig[],
): Promise<void> {
  if (!serverConfigs || serverConfigs.length === 0) {
    return;
  }

  try {
    // Check if external MCP configs loading is enabled
    const settingsService = getSettingsService();
    const settings = await settingsService.getSettings();

    if (settings.loadExternalMCPConfigs === false) {
      return;
    }

    // 既存のサーバを取得して重複を避ける
    const serverService = getServerService();
    const existingServers = serverService.getAllServers();
    const existingServerNames = new Set(
      existingServers.map((s: any) => s.name),
    );

    // 各サーバ設定を処理
    for (const serverConfig of serverConfigs) {
      // 同名のサーバが既に存在する場合はスキップ
      if (existingServerNames.has(serverConfig.name)) {
        continue;
      }

      // サーバを追加
      try {
        serverService.addServer(serverConfig);
        // 既存名のセットに追加
        existingServerNames.add(serverConfig.name);
      } catch (error) {
        console.error(`Failed to import server '${serverConfig.name}':`, error);
      }
    }
  } catch (error) {
    console.error("Failed to sync MCP servers from client config:", error);
  }
}

/**
 * Import existing MCP server configurations from client app settings
 */
export async function importExistingServerConfigurations(): Promise<void> {
  try {
    // Check if external MCP configs loading is enabled
    const settingsService = getSettingsService();
    const settings = await settingsService.getSettings();

    if (settings.loadExternalMCPConfigs === false) {
      return;
    }

    console.log(
      "Checking for existing MCP server configurations in client apps...",
    );

    // Get existing servers to avoid duplicates
    const serverService = getServerService();
    const existingServers = serverService.getAllServers();
    const existingServerNames = new Set(
      existingServers.map((s: any) => s.name),
    );

    // Load all client configurations
    const clientConfigs = await loadAllClientConfigs();

    // Process each configuration
    for (const config of clientConfigs) {
      if (!config.content) continue;

      // Extract server configurations based on client type
      const serverConfigs = extractServerConfigs(
        config.type,
        config.content,
        config.path,
      );

      // Add new server configurations
      for (const serverConfig of serverConfigs) {
        // Skip if a server with this name already exists
        if (existingServerNames.has(serverConfig.name)) {
          continue;
        }

        // Add the server
        try {
          serverService.addServer(serverConfig);
          // Add to existing names set
          existingServerNames.add(serverConfig.name);
        } catch (error) {
          console.error(
            `Failed to import server '${serverConfig.name}' from ${config.type}:`,
            error,
          );
        }
      }
    }
  } catch (error) {
    console.error("Failed to import existing server configurations:", error);
  }
}

/**
 * Load configurations from all supported client apps
 */
async function loadAllClientConfigs(): Promise<ClientConfig[]> {
  // Define client config paths and types
  const clientConfigPaths: ClientConfig[] = [
    { type: "vscode", path: vscodeConfig() },
    { type: "claude", path: claudeConfig() },
    { type: "cline", path: clineConfig() },
    { type: "windsurf", path: windsurfConfig() },
    { type: "cursor", path: cursorConfig() },
  ];

  // Load content for each existing config file
  const results: ClientConfig[] = [];

  for (const config of clientConfigPaths) {
    try {
      if (await exists(config.path)) {
        const content = await fsPromises.readFile(config.path, "utf8");
        try {
          const parsedContent = JSON.parse(content);
          results.push({
            ...config,
            content: parsedContent,
          });
        } catch (parseError) {
          console.error(
            `Failed to parse ${config.type} config file:`,
            parseError,
          );
        }
      }
    } catch (error) {
      console.error(`Error checking ${config.type} config:`, error);
    }
  }

  return results;
}

/**
 * 設定ファイルからMCP設定とトークンを抽出
 */
export async function extractConfigInfo(
  name: string,
  configPath: string,
): Promise<{
  hasMcpConfig: boolean;
  configToken: string;
  otherServers?: MCPServerConfig[];
}> {
  try {
    const fileContent = await fsPromises.readFile(configPath, "utf8");
    const config = JSON.parse(fileContent);

    let hasMcpConfig = false;
    let configToken = "";
    let otherServers: MCPServerConfig[] = [];

    if (name.toLowerCase() === "vscode") {
      // VSCodeの場合
      hasMcpConfig =
        !!config.mcp &&
        !!config.mcp.servers &&
        !!config.mcp.servers["mcp-router"] &&
        config.mcp.servers["mcp-router"].command === "npx" &&
        Array.isArray(config.mcp.servers["mcp-router"].args) &&
        (config.mcp.servers["mcp-router"].args.includes("connect") ||
          config.mcp.servers["mcp-router"].args.includes(
            "@mcp_router/cli@latest",
          ));

      // トークンを取得
      if (config.mcp?.servers?.["mcp-router"]?.env?.MCPR_TOKEN) {
        configToken = config.mcp.servers["mcp-router"].env.MCPR_TOKEN;
      }

      // 他のMCPサーバ設定を抽出
      if (config.mcp?.servers) {
        otherServers = extractServersFromConfig(config.mcp.servers);
      }
    } else {
      // 他のアプリの場合
      hasMcpConfig =
        !!config.mcpServers &&
        !!config.mcpServers["mcp-router"] &&
        config.mcpServers["mcp-router"].command === "npx" &&
        Array.isArray(config.mcpServers["mcp-router"].args) &&
        ((config.mcpServers["mcp-router"].args.some(
          (arg: string) => arg === "mcpr-cli" || arg === "mcpr-cli@latest",
        ) &&
          config.mcpServers["mcp-router"].args.includes("connect")) ||
          config.mcpServers["mcp-router"].args.includes(
            "@mcp_router/cli@latest",
          ));

      // トークンを取得
      if (config.mcpServers?.["mcp-router"]?.env?.MCPR_TOKEN) {
        configToken = config.mcpServers["mcp-router"].env.MCPR_TOKEN;
      }

      // 他のMCPサーバ設定を抽出
      if (config.mcpServers) {
        otherServers = extractServersFromConfig(config.mcpServers);
      }
    }

    return { hasMcpConfig, configToken, otherServers };
  } catch (error) {
    console.error(`Error extracting config info from ${configPath}:`, error);
    return { hasMcpConfig: false, configToken: "" };
  }
}

/**
 * 設定オブジェクトから他のMCPサーバ構成を抽出
 * 標準化されたバージョン - 以前のextractOtherServers関数を置き換え
 */
function extractServersFromConfig(
  servers: Record<string, any>,
): MCPServerConfig[] {
  const configs: MCPServerConfig[] = [];

  for (const [serverName, serverConfig] of Object.entries(servers)) {
    if (serverConfig && typeof serverConfig === "object") {
      // mcp-router 自体は除外
      if (serverName === "mcp-router") continue;

      // サーバ設定を作成
      const config: MCPServerConfig = {
        id: uuidv4(),
        name: serverName,
        serverType: "local",
        command: serverConfig.command,
        args: Array.isArray(serverConfig.args) ? serverConfig.args : [],
        env: serverConfig.env || {},
        disabled: false,
        autoStart: false,
      };

      // 必要なフィールドが存在する場合のみ追加
      if (config.command) {
        configs.push(config);
      }
    }
  }

  return configs;
}

/**
 * Extract MCP server configurations from client config
 */
function extractServerConfigs(
  clientType: ClientType,
  content: any,
  configPath: string,
): MCPServerConfig[] {
  const configs: MCPServerConfig[] = [];

  try {
    switch (clientType) {
      case "vscode":
        // VSCode uses 'mcp.servers' structure
        if (content.mcp?.servers) {
          extractVSCodeServerConfigs(content.mcp.servers, configs, clientType);
        }
        break;

      case "claude":
      case "cline":
      case "windsurf":
      case "cursor":
        // These clients use 'mcpServers' structure
        if (content.mcpServers) {
          extractStandardServerConfigs(
            content.mcpServers,
            configs,
            clientType,
            configPath,
          );
        }
        break;
    }
  } catch (error) {
    console.error(`Error extracting server configs from ${clientType}:`, error);
  }

  return configs;
}

/**
 * Extract server configs from VSCode config format
 */
function extractVSCodeServerConfigs(
  servers: Record<string, any>,
  configs: MCPServerConfig[],
  _clientType: ClientType,
): void {
  for (const [serverName, serverConfig] of Object.entries(servers)) {
    if (serverConfig && typeof serverConfig === "object") {
      // Skip 'mcp-router' server as it's this app itself
      if (serverName === "mcp-router") continue;

      // Create server config
      const config: MCPServerConfig = {
        id: uuidv4(),
        name: serverName,
        serverType: "local",
        command: serverConfig.command,
        args: Array.isArray(serverConfig.args) ? serverConfig.args : [],
        env: serverConfig.env || {},
        disabled: false,
        autoStart: false,
      };

      // Add the config if it has required fields
      if (config.command) {
        configs.push(config);
      }
    }
  }
}

/**
 * Extract server configs from standard client config format
 */
function extractStandardServerConfigs(
  servers: Record<string, any>,
  configs: MCPServerConfig[],
  _clientType: ClientType,
  _configPath: string,
): void {
  for (const [serverName, serverConfig] of Object.entries(servers)) {
    if (serverConfig && typeof serverConfig === "object") {
      // Skip 'mcp-router' server as it's this app itself
      if (serverName === "mcp-router") continue;

      // Create server config
      const config: MCPServerConfig = {
        id: uuidv4(),
        name: serverName,
        serverType: "local",
        command: serverConfig.command,
        args: Array.isArray(serverConfig.args) ? serverConfig.args : [],
        env: serverConfig.env || {},
        disabled: false,
        autoStart: false,
      };

      // Add the config if it has required fields
      if (config.command) {
        configs.push(config);
      }
    }
  }
}
