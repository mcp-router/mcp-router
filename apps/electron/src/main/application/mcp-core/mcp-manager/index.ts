import { MCPServer, MCPServerConfig } from "@mcp_router/shared";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ServerManager } from "./server-manager";
import { AggregatorServer } from "./aggregator-server";
import { LoggingService } from "./logging";
import { RequestHandlers } from "./request-handlers";

/**
 * An integrated MCP server manager that combines server management and aggregation functionality
 */
export class MCPServerManager {
  private serverManager: ServerManager;
  private aggregatorServer: AggregatorServer;
  private loggingService: LoggingService;
  private requestHandlers: RequestHandlers;

  constructor() {
    this.serverManager = new ServerManager();

    // Get server name to ID map from server manager
    const maps = this.serverManager.getMaps();
    this.loggingService = new LoggingService(maps.serverNameToIdMap);

    this.aggregatorServer = new AggregatorServer(
      this.serverManager,
      this.loggingService,
    );

    this.requestHandlers = new RequestHandlers(
      this.serverManager,
      this.loggingService,
    );
  }

  /**
   * Initialize async operations
   */
  public async initializeAsync(): Promise<void> {
    try {
      console.log("[MCPServerManager] Initializing...");

      // Initialize server manager
      await this.serverManager.initializeAsync();

      // Initialize Agent Tools virtual server
      this.aggregatorServer.initAgentToolsServer();

      console.log("[MCPServerManager] Initialization complete");
    } catch (error) {
      console.error("Failed to initialize MCP Server Manager:", error);
    }
  }

  /**
   * Clear all servers from memory (used when switching workspaces)
   */
  public clearAllServers(): void {
    this.serverManager.clearAllServers();
  }

  /**
   * Get server ID by name
   */
  public getServerIdByName(name: string): string | undefined {
    return this.serverManager.getServerIdByName(name);
  }

  /**
   * Get a list of all MCP servers
   */
  public getServers(): MCPServer[] {
    return this.serverManager.getServers();
  }

  /**
   * Add a new MCP server
   */
  public addServer(config: MCPServerConfig): MCPServer {
    return this.serverManager.addServer(config);
  }

  /**
   * Remove an MCP server
   */
  public removeServer(id: string): boolean {
    return this.serverManager.removeServer(id);
  }

  /**
   * Start an MCP server
   */
  public async startServer(id: string, clientId?: string): Promise<boolean> {
    return this.serverManager.startServer(id, clientId);
  }

  /**
   * Stop an MCP server
   */
  public stopServer(id: string, clientId?: string): boolean {
    return this.serverManager.stopServer(id, clientId);
  }

  /**
   * Update an MCP server's configuration
   */
  public updateServer(
    id: string,
    config: Partial<MCPServerConfig>,
  ): MCPServer | undefined {
    return this.serverManager.updateServer(id, config);
  }

  /**
   * Get the status of a specific MCP server
   */
  public getServerStatus(
    id: string,
  ): "running" | "starting" | "stopping" | "stopped" | "error" {
    return this.serverManager.getServerStatus(id);
  }

  /**
   * Update tool permissions for a server
   */
  public updateServerToolPermissions(
    id: string,
    toolPermissions: Record<string, boolean>,
  ): MCPServer | null {
    return this.serverManager.updateServerToolPermissions(id, toolPermissions);
  }

  /**
   * Get the transport
   */
  public getTransport(): StreamableHTTPServerTransport {
    return this.aggregatorServer.getTransport();
  }

  /**
   * Get the aggregator server instance
   */
  public getAggregatorServer(): Server {
    return this.aggregatorServer.getAggregatorServer();
  }

  /**
   * Read a resource by URI (exposed for external use)
   */
  public async readResourceByUri(
    uri: string,
    clientName?: string,
    token?: string,
  ): Promise<any> {
    return this.requestHandlers.readResourceByUri(uri, clientName, token);
  }

  /**
   * Get a prompt by name (exposed for external use)
   */
  public async getPromptByName(
    promptName: string,
    args?: any,
    clientName?: string,
    token?: string,
  ): Promise<any> {
    return this.requestHandlers.getPromptByName(
      promptName,
      args,
      clientName,
      token,
    );
  }

  /**
   * Clean up resources when the app is closing
   */
  public async shutdown(): Promise<void> {
    await this.serverManager.shutdown();
    await this.aggregatorServer.shutdown();
  }
}
