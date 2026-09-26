import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
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
import type { Request, Response } from "express";

/**
 * MCP Aggregator Server that combines multiple MCP servers into one
 */
export class AggregatorServer {
  private aggregatorServer!: Server;
  private transport!: StreamableHTTPServerTransport;
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
  private async initAggregatorServer(): Promise<void> {
    try {
      this.aggregatorServer = this.createAggregatorServer();

      // Start the aggregator server
      await this.startAggregator();
    } catch (error) {
      console.error("Failed to initialize MCP Aggregator Server:", error);
    }
  }

  private createAggregatorServer(): Server {
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

    this.setupRequestHandlers(server);

    server.onerror = (error) => {
      console.error("[MCP Aggregator Error]", error);
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
   * Get the transport
   */
  public getTransport(): StreamableHTTPServerTransport {
    return this.transport;
  }

  /**
   * Get the aggregator server instance
   */
  public getAggregatorServer(): Server {
    return this.aggregatorServer;
  }

  public async handleRequest(
    req: Request,
    res: Response,
    body: unknown,
  ): Promise<void> {
    const server = this.createAggregatorServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } finally {
      await server.close();
    }
  }

  /**
   * Start the aggregator server
   */
  private async startAggregator(): Promise<void> {
    try {
      // StreamableHTTP transport
      this.transport = new StreamableHTTPServerTransport({
        // Stateless server
        sessionIdGenerator: undefined,
      });

      // Connect server with transport
      await this.aggregatorServer.connect(this.transport);
    } catch (error) {
      console.error("Failed to initialize transports:", error);
      throw error;
    }
  }

  /**
   * Set up request handlers for the aggregator server
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
