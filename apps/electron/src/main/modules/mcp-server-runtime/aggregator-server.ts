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
 * MCP Aggregator Server that combines multiple MCP servers into one.
 *
 * Uses stateless mode: a fresh Server + StreamableHTTPServerTransport is
 * created for each incoming request, as required by the MCP SDK which
 * enforces single-use transports in stateless mode.
 */
export class AggregatorServer {
  private requestHandlers: RequestHandlers;

  constructor(
    serverManager: MCPServerManager,
    toolCatalogService?: ToolCatalogService,
  ) {
    this.requestHandlers = new RequestHandlers(
      serverManager,
      toolCatalogService,
    );
  }

  /**
   * Create a fresh Server + StreamableHTTPServerTransport for a single request.
   * The SDK enforces that stateless transports cannot be reused, so we create
   * a new pair per request.
   */
  public async createRequestTransport(): Promise<StreamableHTTPServerTransport> {
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
          experimental: {
            elicitation: {
              form: {},
              url: {},
            },
          },
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

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    return transport;
  }

  /**
   * Create a fresh Server instance for SSE connections.
   * Each SSE client gets its own Server instance since the SDK
   * only allows one transport per Server.
   */
  public createSseServer(): Server {
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
          experimental: {
            elicitation: {
              form: {},
              url: {},
            },
          },
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
   * Set up request handlers on a Server instance
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
    // No persistent server to close; each request creates its own
  }
}
