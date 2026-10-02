import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { RequestHandlers } from "./request-handlers";
import { MCPServerManager } from "../mcp-server-manager/mcp-server-manager";
import { getLogService } from "@/main/modules/mcp-logger/mcp-logger.service";
import type { ToolCatalogService } from "@/main/modules/tool-catalog/tool-catalog.service";

/**
 * MCP Aggregator Server that combines multiple MCP servers into one
 */
export class AggregatorServer {
  private aggregatorServer!: Server;
  private requestHandlers: RequestHandlers;

  constructor(
    serverManager: MCPServerManager,
    toolCatalogService?: ToolCatalogService,
  ) {
    this.requestHandlers = new RequestHandlers(
      serverManager,
      toolCatalogService,
    );
    this.initAggregatorServer();
  }

  /**
   * Initialize the MCP aggregator server
   */
  private initAggregatorServer(): void {
    try {
      this.aggregatorServer = this.createServerInstance();
    } catch (error) {
      console.error("Failed to initialize MCP Aggregator Server:", error);
    }
  }

  /**
   * Create a new aggregator Server instance with all request handlers registered.
   * StreamableHTTP transports are per-request objects, so each request gets its
   * own Server + transport pair instead of sharing one process-wide instance.
   */
  private createServerInstance(): Server {
    const server = new Server(
      {
        name: "mcp-aggregator",
        version: "1.0.0",
      },
      {
        capabilities: {
          resources: {},
          tools: {},
          prompts: {},
        },
      },
    );

    // Set up request handlers
    this.setupRequestHandlers(server);

    // Error handling
    server.onerror = (error) => {
      console.error("[MCP Aggregator Error]", error);
      // Log server errors
      getLogService().recordMcpRequestLog({
        timestamp: new Date().toISOString(),
        requestType: "ServerError",
        params: {},
        result: "error",
        errorMessage: error.message || "Unknown server error",
        duration: 0,
        clientId: "mcp-router-system",
      });
    };

    return server;
  }

  /**
   * Create a fresh Server + StreamableHTTPServerTransport pair for a single
   * HTTP request (stateless mode, sessionIdGenerator: undefined).
   * The caller is responsible for closing the server after the response ends.
   */
  public async createSessionTransport(): Promise<{
    server: Server;
    transport: StreamableHTTPServerTransport;
  }> {
    const server = this.createServerInstance();
    const transport = new StreamableHTTPServerTransport({
      // Stateless server
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    return { server, transport };
  }

  /**
   * Get the aggregator server instance
   */
  public getAggregatorServer(): Server {
    return this.aggregatorServer;
  }

  /**
   * Set up request handlers for the given aggregator server
   */
  private setupRequestHandlers(server: Server): void {
    // List Tools
    server.setRequestHandler(ListToolsRequestSchema, async (request) => {
      const token = request.params?._meta?.token as string | undefined;
      const projectId = request.params?._meta?.projectId;
      return await this.requestHandlers.handleListTools(token, projectId);
    });

    // Call Tool
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      return await this.requestHandlers.handleCallTool(request);
    });

    // List Resources
    server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
      const token = request.params?._meta?.token as string | undefined;
      const projectId = request.params?._meta?.projectId;
      return await this.requestHandlers.handleListResources(token, projectId);
    });

    // List Resource Templates
    server.setRequestHandler(
      ListResourceTemplatesRequestSchema,
      async (request) => {
        const token = request.params?._meta?.token as string | undefined;
        const projectId = request.params?._meta?.projectId;
        return await this.requestHandlers.handleListResourceTemplates(
          token,
          projectId,
        );
      },
    );

    // Read Resource
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;
      const token = request.params?._meta?.token as string | undefined;
      const projectId = request.params?._meta?.projectId;
      return await this.requestHandlers.readResourceByUri(
        uri,
        token,
        projectId,
      );
    });

    // List Prompts
    server.setRequestHandler(ListPromptsRequestSchema, async (request) => {
      const token = request.params?._meta?.token as string | undefined;
      const projectId = request.params?._meta?.projectId;
      const allPrompts = await this.requestHandlers.getAllPromptsInternal(
        token,
        projectId,
      );
      return { prompts: allPrompts };
    });

    // Get Prompt
    server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const promptName = request.params.name;
      const token = request.params?._meta?.token as string | undefined;
      const projectId = request.params?._meta?.projectId;
      return await this.requestHandlers.getPromptByName(
        promptName,
        request.params.arguments,
        token,
        projectId,
      );
    });
  }

  /**
   * Clean up resources
   */
  public async shutdown(): Promise<void> {
    try {
      await this.aggregatorServer.close();
    } catch (err) {
      console.error("Error shutting down aggregator server:", err);
    }
  }
}
