import { promises as fsPromises } from "fs";
import { getServerService } from "@/main/modules/mcp-server-manager/server-service";
import { MCPServerConfig, ClientType, ClientConfig } from "@mcp_router/shared";
import { v4 as uuidv4 } from "uuid";
import { getSettingsService } from "@/main/modules/settings/settings.service";
import { AppPaths } from "./app-paths";
import {
  STANDARD_APP_DEFINITIONS,
  findStandardAppDefinition,
} from "./app-definitions";

// Helper to match CLI arg variations like "@mcp_router/cli", "@mcp_router/cli@latest", "@mcp_router/cli@0.x",
// and legacy aliases like "mcpr-cli", "mcpr-cli@latest"
function isMcpRouterCliArg(arg: string): boolean {
  if (!arg || typeof arg !== "string") return false;
  return (
    /^@mcp_router\/cli(?:@.*)?$/.test(arg) || /^mcpr-cli(?:@.*)?$/.test(arg)
  );
}

function stripOuterQuotes(val: any): any {
  if (typeof val !== "string") return val;
  let s = val.trim();
  // Remove single or double quotes if present on both ends
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1);
  }
  // Also remove stray leading/trailing quotes if mismatched
  if (s.startsWith('"') || s.startsWith("'")) s = s.slice(1);
  if (s.endsWith('"') || s.endsWith("'")) s = s.slice(0, -1);
  return s;
}

// Fallback: extract MCPR_TOKEN from TOML by scanning env table text
function extractCodexTokenFromToml(tomlText: string): string | null {
  const lines = tomlText.replace(/\r\n?/g, "\n").split("\n");
  let inTargetEnv = false;

  const envTableNames = new Set([
    "mcp_servers.mcp_router.env",
    "mcp_servers.mcp-router.env",
    "mcp.servers.mcp_router.env",
    "mcp.servers.mcp-router.env",
  ]);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("[")) {
      const tableName = line.replace(/^\[\s*/, "").replace(/\s*\]$/, "");
      const normalized = tableName.replace(/"/g, "");
      inTargetEnv = envTableNames.has(normalized);
      continue;
    }

    if (!inTargetEnv) continue;

    const m = line.match(/^MCPR_TOKEN\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s#]+))/);
    if (m) {
      const token = m[1] || m[2] || m[3] || "";
      return stripOuterQuotes(token);
    }
  }

  return null;
}

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
  const appPaths = new AppPaths();
  const clientConfigPaths: ClientConfig[] = STANDARD_APP_DEFINITIONS.map(
    (definition) => ({
      type: definition.clientType,
      path: definition.getConfigPath(appPaths),
    }),
  );

  // Load content for each existing config file
  const results: ClientConfig[] = [];

  for (const config of clientConfigPaths) {
    try {
      if (await appPaths.exists(config.path)) {
        const content = await fsPromises.readFile(config.path, "utf8");
        try {
          if (config.type === "codex") {
            const mcpServers = parseCodexTomlServers(content);
            results.push({
              ...config,
              content: { mcpServers },
            });
          } else {
            const parsedContent = JSON.parse(content);
            results.push({
              ...config,
              content: parsedContent,
            });
          }
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
    const definition = findStandardAppDefinition(name);
    const configKind = definition?.configKind ?? "standard-json";

    const config =
      configKind === "codex-toml"
        ? { mcpServers: parseCodexTomlServers(fileContent) }
        : JSON.parse(fileContent);

    let hasMcpConfig = false;
    let configToken = "";
    let otherServers: MCPServerConfig[] = [];

    switch (configKind) {
      case "vscode-json": {
        const servers = (config as any).servers;
        const argsArr = servers?.["mcp-router"]?.args;
        hasMcpConfig =
          !!servers &&
          !!servers["mcp-router"] &&
          servers["mcp-router"].command === "npx" &&
          Array.isArray(argsArr) &&
          argsArr.includes("connect") &&
          argsArr.some(isMcpRouterCliArg);

        if (servers?.["mcp-router"]?.env?.MCPR_TOKEN) {
          configToken = stripOuterQuotes(servers["mcp-router"].env.MCPR_TOKEN);
        }

        if (servers) {
          otherServers = extractServersFromConfig(servers);
        }
        break;
      }
      case "codex-toml": {
        const servers = (config as any).mcpServers || {};
        const mcpr = servers["mcp-router"] || servers["mcp_router"];
        const argsArr = mcpr?.args;
        const hasCommand = !!mcpr && mcpr.command === "npx";
        const hasArgs = Array.isArray(argsArr);
        const hasConnect =
          !!hasArgs && (argsArr as string[]).includes("connect");
        const hasCli =
          !!hasArgs && (argsArr as string[]).some(isMcpRouterCliArg);
        hasMcpConfig = !!(hasCommand && hasArgs && hasConnect && hasCli);

        if (mcpr?.env?.MCPR_TOKEN) {
          configToken = stripOuterQuotes(mcpr.env.MCPR_TOKEN);
        }
        if (!configToken) {
          const fallback = extractCodexTokenFromToml(fileContent);
          if (fallback) {
            configToken = fallback;
          }
        }

        otherServers = extractServersFromConfig(servers);
        break;
      }
      default: {
        const servers = (config as any).mcpServers;
        const srv = servers?.["mcp-router"];
        const argsArr = srv?.args;
        hasMcpConfig =
          !!servers &&
          !!srv &&
          srv.command === "npx" &&
          Array.isArray(argsArr) &&
          argsArr.includes("connect") &&
          argsArr.some(isMcpRouterCliArg);

        if (servers?.["mcp-router"]?.env?.MCPR_TOKEN) {
          configToken = stripOuterQuotes(servers["mcp-router"].env.MCPR_TOKEN);
        }

        if (servers) {
          otherServers = extractServersFromConfig(servers);
        }
        break;
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
      if (serverName === "mcp-router" || serverName === "mcp_router") continue;

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
        // VSCode uses 'servers' structure
        if (content.servers) {
          extractVSCodeServerConfigs(content.servers, configs, clientType);
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
      case "codex":
        // Codex config is TOML; we already normalized to { mcpServers }
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
 * Parse Codex config.toml and extract MCP servers
 * Supports both tables like [mcp.servers."name"] and array-of-tables [[mcp.servers]] with name="..."
 */
function parseCodexTomlServers(tomlText: string): Record<string, any> {
  const servers: Record<string, any> = {};

  // Normalize newlines
  const text = tomlText.replace(/\r\n?/g, "\n");

  // Helper to parse key = "value" pairs inside a block
  const parseKeyValue = (block: string): Record<string, any> => {
    const result: Record<string, any> = {};
    const lines = block.split(/\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || line.startsWith("[")) continue;
      const m = line.match(/^(\w[\w\-]*)\s*=\s*(.*)$/);
      if (!m) continue;
      const key = m[1];
      let value = m[2].trim();
      // Strip comments at EOL
      value = value.replace(/\s+#.*$/, "").trim();

      // String
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        result[key] = value.slice(1, -1);
        continue;
      }
      // Array of strings
      if (value.startsWith("[") && value.endsWith("]")) {
        const inner = value.slice(1, -1);
        const arr = inner
          .split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) =>
            s.startsWith('"') && s.endsWith('"')
              ? s.slice(1, -1)
              : s.replace(/^'|'$/g, ""),
          );
        result[key] = arr;
        continue;
      }
      // Inline table for env: { KEY = "VALUE", ... }
      if (value.startsWith("{") && value.endsWith("}")) {
        const inner = value.slice(1, -1);
        const env: Record<string, string> = {};
        inner
          .split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/)
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((pair) => {
            const mm = pair.match(/^(\w[\w\-]*)\s*=\s*(.+)$/);
            if (!mm) return;
            const k = mm[1];
            let v = mm[2].trim();
            if (
              (v.startsWith('"') && v.endsWith('"')) ||
              (v.startsWith("'") && v.endsWith("'"))
            ) {
              v = v.slice(1, -1);
            }
            env[k] = v;
          });
        result[key] = env;
        continue;
      }
      // Bare words
      result[key] = value;
    }
    return result;
  };

  // Parse [mcp.servers."name"] and [mcp_servers.name] styles
  const tableRe =
    /^\s*\[\s*(?:mcp\.servers|mcp_servers)\.(?:"([^"]+)"|([^\]\n#]+))\s*]\s*\n([\s\S]*?)(?=^\s*\[|\Z)/gm;
  let m: RegExpExecArray | null;
  while ((m = tableRe.exec(text))) {
    const name = (m[1] || m[2] || "").trim();
    // Skip accidental match of nested env table as a server
    if (name.endsWith(".env")) {
      continue;
    }
    const body = m[3] || "";
    const data = parseKeyValue(body);
    // Look for nested env table [mcp.servers."name".env] or [mcp_servers.name.env]
    const envTableRe = new RegExp(
      String.raw`^\s*\[\s*(?:mcp\.servers|mcp_servers)\.(?:"${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"|${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\.env\s*]\s*\n([\s\S]*?)(?=^\s*\[|\Z)`,
      "gm",
    );
    // Prefer the last matching env table for this server name
    let envMatch: RegExpExecArray | null;
    let lastEnvBlock: string | null = null;
    while ((envMatch = envTableRe.exec(text))) {
      lastEnvBlock = envMatch[1] || "";
    }
    if (lastEnvBlock !== null) {
      const envPairs = parseKeyValue(lastEnvBlock);
      data.env = Object.fromEntries(
        Object.entries(envPairs).map(([k, v]) => [
          k,
          stripOuterQuotes(typeof v === "string" ? v : String(v)),
        ]),
      );
    }

    if (name) {
      servers[name] = {
        command: data.command,
        args: Array.isArray(data.args) ? data.args : [],
        env: (data.env as Record<string, string>) || {},
      };
    }
  }

  // Parse array-of-tables [[mcp.servers]] or [[mcp_servers]] with name="..."
  const arrRe =
    /^\s*\[\[\s*(?:mcp\.servers|mcp_servers)\s*]]\s*\n([\s\S]*?)(?=^\s*\[|\Z)/gm;
  while ((m = arrRe.exec(text))) {
    const body = m[1] || "";
    const data = parseKeyValue(body);
    const name = (data as any).name as string;
    if (!name) continue;

    // Optional inline or subsequent env table
    const envTableRe2 = new RegExp(
      String.raw`^\s*\[\s*(?:mcp\.servers|mcp_servers)\.env\s*]\s*\n([\s\S]*?)(?=^\s*\[|\Z)`,
      "gm",
    );
    // Prefer the last env table appearance
    let envMatch2: RegExpExecArray | null;
    let lastEnvBlock2: string | null = null;
    while ((envMatch2 = envTableRe2.exec(text))) {
      lastEnvBlock2 = envMatch2[1] || "";
    }
    if (lastEnvBlock2 !== null) {
      const envPairs = parseKeyValue(lastEnvBlock2);
      data.env = Object.fromEntries(
        Object.entries(envPairs).map(([k, v]) => [
          k,
          stripOuterQuotes(typeof v === "string" ? v : String(v)),
        ]),
      );
    }

    servers[name] = {
      command: data.command,
      args: Array.isArray(data.args) ? data.args : [],
      env: (data.env as Record<string, string>) || {},
    };
  }

  return servers;
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
      if (serverName === "mcp-router" || serverName === "mcp_router") continue;

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
