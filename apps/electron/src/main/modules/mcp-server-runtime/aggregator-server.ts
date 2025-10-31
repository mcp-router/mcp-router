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

/**
 * MCP Aggregator Server that combines multiple MCP servers into one
 */
export class AggregatorServer {
  private aggregatorServer!: Server;
  private transport!: StreamableHTTPServerTransport;
  private requestHandlers: RequestHandlers;

  constructor(serverManager: MCPServerManager) {
    this.requestHandlers = new RequestHandlers(serverManager);
    this.initAggregatorServer();
  }

  /**
   * Initialize the MCP aggregator server
   */
  private async initAggregatorServer(): Promise<void> {
    try {
      // Initialize the MCP server
      this.aggregatorServer = new Server(
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
      this.setupRequestHandlers();

      // Error handling
      this.aggregatorServer.onerror = (error) => {
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

      // Start the aggregator server
      await this.startAggregator();
    } catch (error) {
      console.error("Failed to initialize MCP Aggregator Server:", error);
    }
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
  private setupRequestHandlers(): void {
    // List Tools
    this.aggregatorServer.setRequestHandler(
      ListToolsRequestSchema,
      async (request) => {
        const token = request.params?._meta?.token as string | undefined;
        return await this.requestHandlers.handleListTools(token);
      },
    );

    // Call Tool
    this.aggregatorServer.setRequestHandler(
      CallToolRequestSchema,
      async (request) => {
        return await this.requestHandlers.handleCallTool(request);
      },
    );

    // List Resources
    this.aggregatorServer.setRequestHandler(
      ListResourcesRequestSchema,
      async (request) => {
        const token = request.params?._meta?.token as string | undefined;
        return await this.requestHandlers.handleListResources(token);
      },
    );

    // List Resource Templates
    this.aggregatorServer.setRequestHandler(
      ListResourceTemplatesRequestSchema,
      async (request) => {
        const token = request.params?._meta?.token as string | undefined;
        return await this.requestHandlers.handleListResourceTemplates(token);
      },
    );

    // Read Resource
    this.aggregatorServer.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        const uri = request.params.uri;
        const token = request.params?._meta?.token as string | undefined;
        return await this.requestHandlers.readResourceByUri(uri, token);
      },
    );

    // List Prompts
    this.aggregatorServer.setRequestHandler(
      ListPromptsRequestSchema,
      async (request) => {
        const token = request.params?._meta?.token as string | undefined;
        const allPrompts =
          await this.requestHandlers.getAllPromptsInternal(token);
        return { prompts: allPrompts };
      },
    );

    // Get Prompt
    this.aggregatorServer.setRequestHandler(
      GetPromptRequestSchema,
      async (request) => {
        const promptName = request.params.name;
        const token = request.params?._meta?.token as string | undefined;
        return await this.requestHandlers.getPromptByName(
          promptName,
          request.params.arguments,
          token,
        );
      },
    );
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
