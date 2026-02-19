/**
 * Server Discovery Service
 *
 * Scans IDE configurations and project directories for MCP server definitions
 * that are not yet managed by MCP Router. Provides read-only discovery results
 * that can be presented to the user for manual approval/import.
 *
 * Supported sources:
 * - IDE global configs (Claude Desktop, Cursor, VS Code, Cline, Windsurf, etc.)
 * - Project-level configs (.mcp.json, .mcp/config.json, .vscode/mcp.json, .cursor/mcp.json)
 *
 * Limitations:
 * - YAML configs (Continue, Goose) are not parsed (would require a YAML dependency)
 * - TOML configs (Codex) use regex-based parsing for basic extraction
 * - No file watching; discovery is triggered manually via scan methods
 */

import { promises as fsPromises } from "fs";
import path from "path";
import { STANDARD_CLIENTS } from "@/main/modules/client-apps/client-definitions";
import { getServerService } from "./server-service";

// =============================================================================
// Types
// =============================================================================

export interface DiscoveredServer {
  /** Display name for the server */
  name: string;
  /** Command to launch the server (stdio transport) */
  command?: string;
  /** Arguments for the command */
  args?: string[];
  /** Remote URL (SSE or streamable-http transport) */
  url?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Human-readable source label, e.g. "VS Code config", ".mcp.json" */
  source: string;
  /** Full filesystem path to the config file that defined this server */
  sourcePath: string;
  /** Transport type inferred from the config */
  transport: "stdio" | "sse" | "streamable-http";
}

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Determine the transport type from a server entry's fields.
 */
function inferTransport(
  entry: Record<string, unknown>,
): "stdio" | "sse" | "streamable-http" {
  if (entry.url && typeof entry.url === "string") {
    // Heuristic: if the URL contains "/sse" it is likely an SSE endpoint
    const urlStr = entry.url as string;
    if (urlStr.includes("/sse")) {
      return "sse";
    }
    return "streamable-http";
  }
  return "stdio";
}

/**
 * Build a DiscoveredServer from a parsed JSON server entry.
 */
function buildDiscoveredServer(
  name: string,
  entry: Record<string, unknown>,
  source: string,
  sourcePath: string,
): DiscoveredServer {
  const transport = inferTransport(entry);

  const server: DiscoveredServer = {
    name,
    source,
    sourcePath,
    transport,
  };

  if (entry.command && typeof entry.command === "string") {
    server.command = entry.command;
  }
  if (Array.isArray(entry.args)) {
    server.args = entry.args.map(String);
  }
  if (entry.url && typeof entry.url === "string") {
    server.url = entry.url;
  }
  if (entry.env && typeof entry.env === "object" && !Array.isArray(entry.env)) {
    server.env = entry.env as Record<string, string>;
  }

  return server;
}

/**
 * Extract server entries from a parsed JSON config object.
 *
 * Handles the common formats used by various IDEs:
 *   { mcpServers: { name: {...} } }       — Claude Desktop, Cursor, Cline/Roo
 *   { servers: { name: {...} } }           — VS Code
 *   { mcp: { name: {...} } }              — OpenCode
 *   { mcpServers: { name: { type, ... } } } — nested type field
 */
function extractServersFromJson(
  config: Record<string, unknown>,
  source: string,
  sourcePath: string,
): DiscoveredServer[] {
  const results: DiscoveredServer[] = [];

  const containers: Array<{ key: string; obj: Record<string, unknown> }> = [];

  if (config.mcpServers && typeof config.mcpServers === "object") {
    containers.push({
      key: "mcpServers",
      obj: config.mcpServers as Record<string, unknown>,
    });
  }
  if (config.servers && typeof config.servers === "object") {
    containers.push({
      key: "servers",
      obj: config.servers as Record<string, unknown>,
    });
  }
  if (config.mcp && typeof config.mcp === "object") {
    containers.push({
      key: "mcp",
      obj: config.mcp as Record<string, unknown>,
    });
  }

  for (const { obj } of containers) {
    for (const [serverName, serverDef] of Object.entries(obj)) {
      if (
        !serverDef ||
        typeof serverDef !== "object" ||
        Array.isArray(serverDef)
      ) {
        continue;
      }
      const entry = serverDef as Record<string, unknown>;

      // Skip entries that do not look like server definitions
      // (must have at least a command, url, or type field)
      if (!entry.command && !entry.url && !entry.type) {
        continue;
      }

      results.push(
        buildDiscoveredServer(serverName, entry, source, sourcePath),
      );
    }
  }

  return results;
}

/**
 * Extract server entries from a TOML config string using regex.
 * This handles the Codex config format: [mcp_servers.<name>]
 */
function extractServersFromToml(
  content: string,
  source: string,
  sourcePath: string,
): DiscoveredServer[] {
  const results: DiscoveredServer[] = [];

  // Match [mcp_servers.<name>] sections (not .env sub-sections)
  const sectionPattern = /\[mcp_servers\.(\w[\w-]*)\](?!\.\w)/g;
  let match: RegExpExecArray | null;

  while ((match = sectionPattern.exec(content)) !== null) {
    const serverName = match[1];
    const sectionStart = match.index + match[0].length;

    // Find end of section (next [...] header or end of file)
    const nextSectionMatch = content
      .slice(sectionStart)
      .match(/\n\[(?!mcp_servers\.\w+\.env)/);
    const sectionEnd = nextSectionMatch
      ? sectionStart + (nextSectionMatch.index ?? content.length)
      : content.length;

    const sectionContent = content.slice(sectionStart, sectionEnd);

    // Parse key-value pairs from the section
    const command = extractTomlValue(sectionContent, "command");
    const argsStr = extractTomlArray(sectionContent, "args");

    // Also look for the .env sub-section
    const envSectionPattern = new RegExp(
      `\\[mcp_servers\\.${serverName}\\.env\\]([\\s\\S]*?)(?=\\n\\[|$)`,
    );
    const envMatch = content.match(envSectionPattern);
    const env: Record<string, string> = {};
    if (envMatch) {
      const envContent = envMatch[1];
      const envPairs = envContent.matchAll(/^\s*(\w+)\s*=\s*"([^"]*)"/gm);
      for (const pair of envPairs) {
        env[pair[1]] = pair[2];
      }
    }

    const server: DiscoveredServer = {
      name: serverName,
      source,
      sourcePath,
      transport: "stdio",
    };

    if (command) {
      server.command = command;
    }
    if (argsStr) {
      server.args = argsStr;
    }
    if (Object.keys(env).length > 0) {
      server.env = env;
    }

    results.push(server);
  }

  return results;
}

/**
 * Extract a string value from a TOML section.
 */
function extractTomlValue(
  sectionContent: string,
  key: string,
): string | undefined {
  const match = sectionContent.match(
    new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, "m"),
  );
  return match ? match[1] : undefined;
}

/**
 * Extract an array of strings from a TOML section.
 */
function extractTomlArray(
  sectionContent: string,
  key: string,
): string[] | undefined {
  const match = sectionContent.match(
    new RegExp(`^\\s*${key}\\s*=\\s*\\[([^\\]]*)]`, "m"),
  );
  if (!match) return undefined;

  const items = match[1].match(/"([^"]*)"/g);
  if (!items) return undefined;

  return items.map((item) => item.replace(/^"|"$/g, ""));
}

/**
 * Safely read and parse a JSON file. Returns null on any error.
 */
async function safeReadJson(
  filePath: string,
): Promise<Record<string, unknown> | null> {
  try {
    const content = await fsPromises.readFile(filePath, "utf8");
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Safely read a file as text. Returns null on any error.
 */
async function safeReadText(filePath: string): Promise<string | null> {
  try {
    return await fsPromises.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

/**
 * Check if a file exists.
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fsPromises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// ServerDiscoveryService
// =============================================================================

/**
 * Service for discovering MCP servers from IDE configs and project directories.
 *
 * This is a read-only discovery service. It does not modify any configuration
 * files or automatically add servers to MCP Router. Results are intended to be
 * presented to the user for manual import.
 */
export class ServerDiscoveryService {
  private static instance: ServerDiscoveryService | null = null;

  /** Cached results from the most recent scan */
  private lastScanResults: DiscoveredServer[] = [];

  /**
   * Get the singleton instance
   */
  public static getInstance(): ServerDiscoveryService {
    if (!ServerDiscoveryService.instance) {
      ServerDiscoveryService.instance = new ServerDiscoveryService();
    }
    return ServerDiscoveryService.instance;
  }

  /**
   * Reset the instance
   */
  public static resetInstance(): void {
    ServerDiscoveryService.instance = null;
  }

  /**
   * Scan all known IDE configuration files for MCP server entries.
   *
   * Reads config files for Claude Desktop, Cursor, VS Code, Cline, Windsurf,
   * and other supported clients. Skips clients that use YAML or env-only
   * config formats since those require additional parsing dependencies.
   *
   * @returns Array of discovered servers not already managed by MCP Router
   */
  public async scanIDEConfigs(): Promise<DiscoveredServer[]> {
    const platform = process.platform as "darwin" | "win32" | "linux";
    const discovered: DiscoveredServer[] = [];

    const scanPromises = STANDARD_CLIENTS.map(async (client) => {
      // Skip clients without MCP config paths
      const configPath = client.mcpConfigPath[platform];
      if (!configPath) {
        return [];
      }

      // Skip formats we cannot parse (YAML requires a dependency, env-only has no servers)
      if (
        client.configFormat === "yaml" ||
        client.configFormat === "env-only"
      ) {
        return [];
      }

      const exists = await fileExists(configPath);
      if (!exists) {
        return [];
      }

      const source = `${client.name} config`;

      try {
        if (client.configFormat === "toml") {
          const content = await safeReadText(configPath);
          if (!content) return [];
          return extractServersFromToml(content, source, configPath);
        }

        // Default: JSON format
        const config = await safeReadJson(configPath);
        if (!config) return [];
        return extractServersFromJson(config, source, configPath);
      } catch {
        // Corrupt or unreadable config -- skip gracefully
        return [];
      }
    });

    const results = await Promise.all(scanPromises);
    for (const batch of results) {
      discovered.push(...batch);
    }

    // Filter out servers already managed by MCP Router
    const filtered = this.filterAlreadyManaged(discovered);
    this.lastScanResults = filtered;
    return filtered;
  }

  /**
   * Scan a project directory for MCP server configuration files.
   *
   * Looks for:
   *   - .mcp.json          (standard project-level MCP config)
   *   - .mcp/config.json   (alternative project-level config)
   *   - .vscode/mcp.json   (VS Code project-level MCP config)
   *   - .cursor/mcp.json   (Cursor project-level MCP config)
   *
   * @param dirPath Absolute path to the project directory
   * @returns Array of discovered servers not already managed by MCP Router
   */
  public async scanProjectDirectory(
    dirPath: string,
  ): Promise<DiscoveredServer[]> {
    const discovered: DiscoveredServer[] = [];

    const configLocations: Array<{ relativePath: string; source: string }> = [
      { relativePath: ".mcp.json", source: ".mcp.json" },
      {
        relativePath: path.join(".mcp", "config.json"),
        source: ".mcp/config.json",
      },
      {
        relativePath: path.join(".vscode", "mcp.json"),
        source: ".vscode/mcp.json",
      },
      {
        relativePath: path.join(".cursor", "mcp.json"),
        source: ".cursor/mcp.json",
      },
    ];

    const scanPromises = configLocations.map(
      async ({ relativePath, source }) => {
        const configPath = path.join(dirPath, relativePath);
        const exists = await fileExists(configPath);
        if (!exists) {
          return [];
        }

        try {
          const config = await safeReadJson(configPath);
          if (!config) return [];
          return extractServersFromJson(config, source, configPath);
        } catch {
          return [];
        }
      },
    );

    const results = await Promise.all(scanPromises);
    for (const batch of results) {
      discovered.push(...batch);
    }

    // Filter out servers already managed by MCP Router
    const filtered = this.filterAlreadyManaged(discovered);
    this.lastScanResults = filtered;
    return filtered;
  }

  /**
   * Return all discovered servers from the most recent scan that are not
   * already managed by MCP Router.
   *
   * This re-filters against the current managed server list, so it stays
   * accurate even if servers have been added since the last scan.
   *
   * @returns Array of discovered servers not already managed
   */
  public getDiscoveredServers(): DiscoveredServer[] {
    return this.filterAlreadyManaged(this.lastScanResults);
  }

  // ===========================================================================
  // Private helpers
  // ===========================================================================

  /**
   * Filter out servers that are already managed by MCP Router.
   *
   * Matching criteria:
   * - For stdio servers: compare by (command + serialized args)
   * - For remote servers: compare by URL
   * - Name-based matching as a secondary signal (case-insensitive)
   *
   * Also filters out entries that look like the MCP Router's own proxy entry
   * (command contains "mcp_router" or "@mcp_router/cli").
   */
  private filterAlreadyManaged(
    discovered: DiscoveredServer[],
  ): DiscoveredServer[] {
    let managedServers: Array<{
      name: string;
      command?: string;
      args?: string[];
      remoteUrl?: string;
    }>;

    try {
      managedServers = getServerService().getAllServers();
    } catch {
      // If the server service is unavailable (e.g. during startup), skip filtering
      return discovered;
    }

    // Build lookup sets for fast matching
    const managedCommandKeys = new Set<string>();
    const managedUrls = new Set<string>();
    const managedNames = new Set<string>();

    for (const server of managedServers) {
      if (server.command) {
        const key = buildCommandKey(server.command, server.args);
        managedCommandKeys.add(key);
      }
      if (server.remoteUrl) {
        managedUrls.add(normalizeUrl(server.remoteUrl));
      }
      managedNames.add(server.name.toLowerCase());
    }

    return discovered.filter((server) => {
      // Skip MCP Router's own proxy entries
      if (isMcpRouterEntry(server)) {
        return false;
      }

      // Check command+args match (stdio servers)
      if (server.command) {
        const key = buildCommandKey(server.command, server.args);
        if (managedCommandKeys.has(key)) {
          return false;
        }
      }

      // Check URL match (remote servers)
      if (server.url) {
        if (managedUrls.has(normalizeUrl(server.url))) {
          return false;
        }
      }

      // Check name match (secondary signal)
      if (managedNames.has(server.name.toLowerCase())) {
        return false;
      }

      return true;
    });
  }
}

// =============================================================================
// Module-level helpers
// =============================================================================

/**
 * Build a normalized key from command + args for comparison.
 */
function buildCommandKey(command: string, args?: string[]): string {
  const normalizedArgs = args ? args.join("\0") : "";
  return `${command}\0${normalizedArgs}`.toLowerCase();
}

/**
 * Normalize a URL for comparison (strip trailing slash, lowercase).
 */
function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, "").toLowerCase();
}

/**
 * Check if a discovered server entry is MCP Router's own proxy.
 */
function isMcpRouterEntry(server: DiscoveredServer): boolean {
  const commandStr = (server.command || "").toLowerCase();
  const argsStr = (server.args || []).join(" ").toLowerCase();
  const combined = `${commandStr} ${argsStr}`;

  return (
    combined.includes("@mcp_router/cli") ||
    combined.includes("mcp_router") ||
    server.name === "mcp-router" ||
    server.name === "router" ||
    server.name === "mcp_router"
  );
}
