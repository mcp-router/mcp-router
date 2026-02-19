import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import { EventEmitter } from "events";
import {
  MCPServer,
  MCPServerConfig,
  MCPTool,
  MCPInputParam,
} from "@mcp_router/shared";
import {
  getServerService,
  ServerService,
} from "@/main/modules/mcp-server-manager/server-service";

/**
 * Substitutes parameter placeholders in args with actual values from env and inputParams
 */
function substituteArgsParameters(
  argsTemplate: string[],
  env: Record<string, string>,
  inputParams: Record<string, MCPInputParam>,
): string[] {
  return argsTemplate.map((arg) => {
    const match = arg.match(/^\$\{(.+)\}$/);
    if (match) {
      const fullParamName = match[1];

      if (fullParamName.startsWith("user_config.")) {
        const paramName = fullParamName.substring("user_config.".length);
        if (inputParams[paramName]) {
          const param = inputParams[paramName];
          if (param.default !== undefined) {
            return String(param.default);
          }
        }
      }

      if (env[fullParamName]) {
        return env[fullParamName];
      }

      if (inputParams[fullParamName]) {
        const param = inputParams[fullParamName];
        if (param.default !== undefined) {
          return String(param.default);
        }
      }
    }
    return arg;
  });
}
import { CreateMessageRequest } from "@modelcontextprotocol/sdk/types.js";
import { getLogService } from "@/main/modules/mcp-logger/mcp-logger.service";
import { getHealthMetricsTracker } from "@/main/modules/mcp-server-runtime/health-metrics-tracker";
import { getSamplingProxy } from "@/main/modules/mcp-server-runtime/sampling-proxy";
import { DevWatcherService } from "./dev-watcher.service";
import { ReconnectingMCPClient } from "./reconnecting-mcp-client";
import { ConnectionState } from "./connection-monitor";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { getUserShellEnv } from "@/main/utils/env-utils";

/**
 * Core server lifecycle management
 */
export class MCPServerManager {
  private servers: Map<string, MCPServer> = new Map();
  private clients: Map<string, ReconnectingMCPClient> = new Map();
  private serverNameToIdMap: Map<string, string> = new Map();
  private serverStatusMap: Map<string, boolean> = new Map();
  private serversDir: string;
  private serverService!: ServerService;
  private eventEmitter = new EventEmitter();
  private devWatcher: DevWatcherService;
  private cachedShellEnv: Record<string, string> = {};

  constructor() {
    this.serversDir = path.join(app.getPath("userData"), "mcp-servers");
    if (!fs.existsSync(this.serversDir)) {
      fs.mkdirSync(this.serversDir, { recursive: true });
    }
    // Set server name to ID map for log service
    getLogService().setServerNameToIdMap(this.serverNameToIdMap);

    // Initialize dev watcher for hot reload support
    this.devWatcher = new DevWatcherService(async (serverId) => {
      console.log(`[MCPServerManager] Hot reloading server ${serverId}`);
      await this.restartServer(serverId);
    });
  }

  /**
   * Initialize async operations
   */
  public async initializeAsync(): Promise<void> {
    try {
      console.log("[MCPServerManager] Initializing...");

      // Cache shell environment for later use (must be done before starting servers)
      console.log("[MCPServerManager] Capturing shell environment...");
      const shellEnv = await getUserShellEnv();
      // Filter out undefined values and store as Record<string, string>
      this.cachedShellEnv = Object.entries(shellEnv).reduce(
        (acc, [key, value]) => {
          if (value !== undefined) {
            acc[key] = value;
          }
          return acc;
        },
        {} as Record<string, string>,
      );
      console.log(
        "[MCPServerManager] Shell environment captured, PATH:",
        this.cachedShellEnv.PATH?.substring(0, 200) + "...",
      );

      // Initialize server service
      this.serverService = getServerService();

      // Load servers from database
      await this.loadServersFromDatabase();

      console.log("[MCPServerManager] Initialization complete");
    } catch (error) {
      console.error("Failed to initialize Server Manager:", error);
    }
  }

  /**
   * Load servers from database
   */
  private async loadServersFromDatabase(): Promise<void> {
    try {
      console.log("[MCPServerManager] Loading servers from database...");
      const servers = this.serverService.getAllServers();
      console.log(
        `[MCPServerManager] Found ${servers.length} servers in database`,
      );

      const autoStartServerIds: string[] = [];

      for (const server of servers) {
        // Initialize all servers as stopped when loading
        server.status = "stopped";
        server.logs = [];
        server.toolPermissions = server.toolPermissions || {};
        this.servers.set(server.id, server);

        // Update server name to ID mapping
        this.updateServerNameMapping(server);

        // Auto start servers if configured
        if (server.autoStart && !server.disabled) {
          autoStartServerIds.push(server.id);
        }
      }

      if (autoStartServerIds.length > 0) {
        await Promise.all(
          autoStartServerIds.map(async (id) => {
            try {
              await this.startServer(id, undefined, false);
            } catch (error) {
              const server = this.servers.get(id);
              const identifier = server?.name || id;
              console.error(
                `[MCPServerManager] Failed to auto-start server ${identifier}:`,
                error,
              );
            }
          }),
        );
      }

      console.log(`[MCPServerManager] ${servers.length} servers loaded`);
    } catch (error) {
      console.error("Error loading servers:", error);
    }
  }

  /**
   * Update server name to ID mapping
   */
  private updateServerNameMapping(server: MCPServer): void {
    this.serverNameToIdMap.set(server.name, server.id);
  }

  /**
   * Get server ID by name
   */
  public getServerIdByName(name: string): string | undefined {
    return this.serverNameToIdMap.get(name);
  }

  public on(
    event:
      | "server-added"
      | "server-updated"
      | "server-removed"
      | "server-started"
      | "server-stopped",
    handler: (serverId: string) => void,
  ): void {
    this.eventEmitter.on(event, handler);
  }

  public off(
    event:
      | "server-added"
      | "server-updated"
      | "server-removed"
      | "server-started"
      | "server-stopped",
    handler: (serverId: string) => void,
  ): void {
    this.eventEmitter.off(event, handler);
  }

  /**
   * Clear all servers from memory (used when switching workspaces)
   */
  public clearAllServers(): void {
    // Stop all running servers
    for (const [id] of this.clients) {
      try {
        this.stopServer(id);
      } catch (error) {
        console.error(`Failed to stop server ${id}:`, error);
      }
    }

    // Clear all maps
    this.servers.clear();
    this.clients.clear();
    this.serverNameToIdMap.clear();
    this.serverStatusMap.clear();
  }

  /**
   * Get a list of all MCP servers
   */
  public getServers(): MCPServer[] {
    // Get latest server info from database
    const dbServers = this.serverService.getAllServers();

    // Add servers from database that aren't in memory
    dbServers.forEach((server: any) => {
      if (!this.servers.has(server.id)) {
        this.servers.set(server.id, {
          ...server,
          status: "stopped",
          logs: [],
        });
        this.updateServerNameMapping(server);
      }
    });

    // Return servers with their current runtime status preserved
    return Array.from(this.servers.values()).map((server) => {
      const currentServer = this.servers.get(server.id);
      return currentServer || server;
    });
  }

  /**
   * Add a new MCP server
   */
  public addServer(config: MCPServerConfig): MCPServer {
    const newServer = this.serverService.addServer(config);
    this.servers.set(newServer.id, newServer);
    this.updateServerNameMapping(newServer);
    this.eventEmitter.emit("server-added", newServer.id);
    return newServer;
  }

  /**
   * Remove an MCP server
   */
  public removeServer(id: string): boolean {
    const server = this.servers.get(id);

    // Stop the server if it's running
    if (this.clients.has(id)) {
      this.stopServer(id);
    }

    // Remove server from all tokens
    this.removeServerFromTokens(id);

    // Remove from database
    const removed = this.serverService.deleteServer(id);

    // Remove from memory if successful
    if (removed && server) {
      this.serverNameToIdMap.delete(server.name);
      this.servers.delete(id);
      this.eventEmitter.emit("server-removed", id);
    }

    return removed;
  }

  /**
   * Remove server ID from all tokens
   */
  private removeServerFromTokens(serverId: string): void {
    try {
      const {
        TokenManager,
      } = require("@/main/modules/client-apps/token-manager");
      const tokenManager = new TokenManager();
      const allTokens = tokenManager.listTokens();

      for (const token of allTokens) {
        if (serverId in (token.serverAccess || {})) {
          const updatedServerAccess = { ...(token.serverAccess || {}) };
          delete updatedServerAccess[serverId];
          tokenManager.updateTokenServerAccess(token.id, updatedServerAccess);
        }
      }
    } catch (error) {
      console.error(
        `Failed to update tokens for server removal ${serverId}:`,
        error,
      );
    }
  }

  /**
   * Start an MCP server
   */
  public async startServer(
    id: string,
    clientId?: string,
    persist: boolean = true,
  ): Promise<boolean> {
    const server = this.servers.get(id);
    if (!server || server.disabled) {
      throw new Error(server ? "Server is disabled" : "Server not found");
    }

    // If already running, do nothing
    if (this.clients.has(id)) {
      return true;
    }

    server.status = "starting";
    const result = await this.connectToServerWithResult(id);

    if (result.status === "error") {
      server.status = "error";
      server.errorMessage = result.error;
      throw new Error(result.error);
    }

    this.clients.set(id, result.client);

    // Register the client
    this.serverStatusMap.set(server.name, true);

    // Update autoStart if persist is true
    if (persist) {
      this.updateServer(id, { autoStart: true });
    }

    // Record log
    getLogService().recordMcpRequestLog({
      timestamp: new Date().toISOString(),
      requestType: "StartServer",
      params: { serverName: server.name },
      result: "success",
      duration: 0,
      clientId: clientId || "unknownClient",
    });

    // Check for dev mode and start file watcher if enabled
    if (server.dev?.enabled && server.dev.watch?.length > 0) {
      const cwd = server.dev.cwd || process.cwd();
      await this.devWatcher.startWatching(id, server.dev.watch, cwd);
    }

    return true;
  }

  /**
   * Stop an MCP server
   */
  public stopServer(
    id: string,
    clientId?: string,
    persist: boolean = true,
  ): boolean {
    const server = this.servers.get(id);
    if (!server) {
      return false;
    }

    const client = this.clients.get(id);
    if (!client) {
      server.status = "stopped";
      return true;
    }

    try {
      server.status = "stopping";

      // Stop dev watcher if running (fire-and-forget to maintain sync signature)
      this.devWatcher.stopWatching(id).catch((err) => {
        console.error(
          `[MCPServerManager] Failed to stop dev watcher for ${id}:`,
          err,
        );
      });

      // Unregister the client
      this.serverStatusMap.set(server.name, false);

      // Update autoStart if persist is true
      if (persist) {
        this.updateServer(id, { autoStart: false });
      }

      // Record log
      getLogService().recordMcpRequestLog({
        timestamp: new Date().toISOString(),
        requestType: "StopServer",
        params: { serverName: server.name },
        result: "success",
        duration: 0,
        clientId: clientId || "unknownClient",
      });

      // Disconnect the client
      client.dispose();
      this.clients.delete(id);
      server.status = "stopped";
      this.eventEmitter.emit("server-stopped", id);
      return true;
    } catch (_error) {
      server.status = "error";
      return false;
    }
  }

  /**
   * Restart an MCP server (used by DevWatcher for hot reload)
   */
  public async restartServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    this.stopServer(serverId, "DevWatcher", false);
    await this.startServer(serverId, "DevWatcher", false);
  }

  /**
   * Update an MCP server's configuration
   */
  public updateServer(
    id: string,
    config: Partial<MCPServerConfig>,
  ): MCPServer | undefined {
    const oldServer = this.servers.get(id);
    const oldName = oldServer?.name;
    const isRenaming = !!(oldServer && config.name && oldName !== config.name);
    if (isRenaming && oldName) {
      this.serverNameToIdMap.delete(oldName);
    }

    const updatedServer = this.serverService.updateServer(id, config);
    if (!updatedServer) {
      return undefined;
    }

    const server = this.servers.get(id);
    if (server) {
      const status = server.status;
      const logs = server.logs || [];
      Object.assign(server, updatedServer, { status, logs });
      server.toolPermissions = server.toolPermissions || {};
      this.updateServerNameMapping(server);
      if (isRenaming && oldName && config.name) {
        const wasRunning = this.serverStatusMap.get(oldName);
        if (this.serverStatusMap.has(oldName)) {
          this.serverStatusMap.delete(oldName);
        }
        if (wasRunning !== undefined) {
          this.serverStatusMap.set(config.name, wasRunning);
        } else if (server.status === "running") {
          this.serverStatusMap.set(config.name, true);
        }
      }
    }

    this.eventEmitter.emit("server-updated", id);

    return updatedServer;
  }

  /**
   * Update tool permissions for a server
   */
  public updateServerToolPermissions(
    id: string,
    toolPermissions: Record<string, boolean>,
  ): MCPServer {
    const server = this.servers.get(id);
    if (!server) {
      throw new Error(`Server not found: ${id}`);
    }

    const updatedConfig: Partial<MCPServerConfig> = { toolPermissions };
    const updatedServer = this.serverService.updateServer(id, updatedConfig);

    if (!updatedServer) {
      throw new Error(
        `Failed to update tool permissions for server: ${server.name}`,
      );
    }

    server.toolPermissions = { ...toolPermissions };

    if (Array.isArray(server.tools)) {
      server.tools = server.tools.map((tool) => ({
        ...tool,
        enabled: toolPermissions[tool.name] !== false,
      }));
    }

    this.eventEmitter.emit("server-updated", id);

    return server;
  }

  /**
   * List tools for a specific server
   */
  public async listServerTools(id: string): Promise<MCPTool[]> {
    const server = this.servers.get(id);
    if (!server) {
      throw new Error("Server not found");
    }

    const client = this.clients.get(id);
    const isRunning =
      !!client &&
      (server.status === "running" || this.serverStatusMap.get(server.name));

    if (!isRunning || !client) {
      throw new Error("Server must be running to list tools");
    }

    const response = await client.getClient().listTools();
    const tools = response?.tools ?? [];
    const permissions = server.toolPermissions || {};
    const toolsWithStatus = tools.map((tool) => ({
      ...tool,
      enabled: permissions[tool.name] !== false,
    }));

    server.tools = toolsWithStatus;
    return toolsWithStatus;
  }

  /**
   * Get the status of a specific MCP server
   */
  public getServerStatus(
    id: string,
  ): "running" | "starting" | "stopping" | "stopped" | "error" {
    const server = this.servers.get(id);
    return server?.status || "error";
  }

  /**
   * Connect to an MCP server
   */
  private async connectToServerWithResult(
    id: string,
  ): Promise<
    | { status: "success"; client: ReconnectingMCPClient }
    | { status: "error"; error: string }
  > {
    const server = this.servers.get(id);
    if (!server) {
      return { status: "error", error: "Server not found" };
    }

    try {
      const createTransport = () => this.createTransportForServer(server);

      // Determine health check URL for HTTP transports
      let healthCheckUrl: string | undefined;
      if (server.serverType === "remote-streamable" && server.remoteUrl) {
        const url = new URL(server.remoteUrl);
        url.pathname = url.pathname.replace(/\/mcp$/, "/api/test");
        healthCheckUrl = url.toString();
      }

      const reconnectingClient = new ReconnectingMCPClient({
        serverId: server.id,
        serverName: server.name,
        createTransport,
        onStatusChange: (state) =>
          this.handleConnectionStateChange(server.id, state),
        healthCheckUrl,
        healthCheckIntervalMs: 30000,
        bearerToken: server.bearerToken,
        maxRetries: 5,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        onSamplingRequest: (params) =>
          getSamplingProxy().createMessage(
            params as CreateMessageRequest["params"],
          ),
      });

      await reconnectingClient.connect();

      return { status: "success", client: reconnectingClient };
    } catch (error) {
      return {
        status: "error",
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Create transport for a server based on its type
   */
  private createTransportForServer(server: MCPServer): Transport {
    if (server.serverType === "remote-streamable") {
      if (!server.remoteUrl) {
        throw new Error("remoteUrl required for remote-streamable server");
      }
      return new StreamableHTTPClientTransport(new URL(server.remoteUrl), {
        sessionId: undefined,
        requestInit: {
          headers: {
            authorization: server.bearerToken
              ? `Bearer ${server.bearerToken}`
              : "",
          },
        },
      });
    } else if (server.serverType === "remote") {
      if (!server.remoteUrl) {
        throw new Error("remoteUrl required for remote server");
      }
      const headers: Record<string, string> = {
        Accept: "text/event-stream",
      };
      if (server.bearerToken) {
        headers["authorization"] = `Bearer ${server.bearerToken}`;
      }
      return new SSEClientTransport(new URL(server.remoteUrl), {
        eventSourceInit: {
          fetch: (url, init) => fetch(url, { ...init, headers }),
        },
        requestInit: { headers },
      });
    } else if (server.serverType === "local") {
      if (!server.command) {
        throw new Error("command required for local server");
      }
      return new StdioClientTransport({
        command: server.command,
        args: server.args
          ? substituteArgsParameters(
              server.args,
              server.env || {},
              server.inputParams || {},
            )
          : undefined,
        env: this.getMergedEnv(server),
      });
    }
    throw new Error(`Unsupported server type: ${server.serverType}`);
  }

  /**
   * Get merged environment variables for a server
   * Uses cached shell environment captured during initialization
   */
  private getMergedEnv(server: MCPServer): Record<string, string> {
    // Use cached shell environment (already cleaned during initializeAsync)
    // Server-specific env variables override the shell environment
    return { ...this.cachedShellEnv, ...server.env };
  }

  /**
   * Handle connection state changes from ReconnectingMCPClient
   */
  private handleConnectionStateChange(
    serverId: string,
    state: ConnectionState,
  ): void {
    const server = this.servers.get(serverId);
    if (!server) return;

    // Record status change for health metrics tracking
    getHealthMetricsTracker().recordStatusChange(serverId, server.name, state);

    // Map ConnectionState to MCPServer status
    switch (state) {
      case "connected":
        server.status = "running";
        server.errorMessage = undefined;
        this.eventEmitter.emit("server-started", serverId);
        break;
      case "connecting":
        server.status = "starting";
        break;
      case "reconnecting":
        server.status = "starting";
        server.errorMessage = "Reconnecting...";
        this.eventEmitter.emit("server-updated", serverId);
        break;
      case "disconnected":
        server.status = "stopped";
        this.eventEmitter.emit("server-stopped", serverId);
        break;
      case "failed":
        server.status = "error";
        server.errorMessage = "Connection failed after max retries";
        this.eventEmitter.emit("server-stopped", serverId);
        break;
    }
  }

  /**
   * Get all maps for sharing with other components.
   * Returns ReadonlyMap types to prevent external mutation at compile time.
   */
  public getMaps(): {
    servers: ReadonlyMap<string, MCPServer>;
    clients: ReadonlyMap<string, ReconnectingMCPClient>;
    serverNameToIdMap: ReadonlyMap<string, string>;
    serverStatusMap: ReadonlyMap<string, boolean>;
  } {
    return {
      servers: this.servers,
      clients: this.clients,
      serverNameToIdMap: this.serverNameToIdMap,
      serverStatusMap: this.serverStatusMap,
    };
  }

  /**
   * Shutdown all servers
   */
  public async shutdown(): Promise<void> {
    // Stop all dev watchers first
    await this.devWatcher.stopAll();

    for (const [id] of this.clients) {
      // Don't persist state changes when shutting down - this is just cleanup
      this.stopServer(id, undefined, false);
    }
  }
}
