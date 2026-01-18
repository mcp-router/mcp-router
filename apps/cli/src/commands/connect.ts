import fetch from "node-fetch";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  InitializeRequestSchema,
  McpError,
  CallToolResult,
  GetPromptResult,
  ReadResourceResult,
} from "@modelcontextprotocol/sdk/types.js";
import { VERSION, SERVER_NAME } from "../mcpr.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * Executes the connect command, connecting to an existing
 * MCP HTTP server running in the MCP Router application and exposing
 * its capabilities as an MCP server using stdio transport.
 */
export async function executeConnect(args: string[] = []): Promise<void> {
  // Parse arguments (if needed)
  const options = parseArgs(args);

  // Create and start the HTTP MCP Bridge Server
  const bridgeServer = new HttpMcpBridgeServer(options);
  await bridgeServer.start();

  // Keep the process running until interrupted
  process.on("SIGINT", async () => {
    await bridgeServer.stop();
    process.exit(0);
  });
}

/**
 * Parse command line arguments
 */
const DEFAULT_BASE_URL = "http://localhost:3282/mcp";

function parseArgs(args: string[]): {
  baseUrl: string;
  project?: string | null;
} {
  let baseUrl = DEFAULT_BASE_URL;
  let project: string | null = null;

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if ((arg === "--url" || arg === "--base-url") && i + 1 < args.length) {
      baseUrl = normalizeBaseUrl(args[i + 1]);
      i++;
    } else if (arg === "--project" && i + 1 < args.length) {
      const projectName = args[i + 1]?.trim();
      if (projectName) {
        project = projectName;
      }
      i++;
    }
  }

  return { baseUrl, project };
}

/**
 * Normalize the base URL, defaulting to http://.../mcp when no path is provided.
 */
function normalizeBaseUrl(rawBaseUrl: string): string {
  const trimmedUrl = rawBaseUrl.trim();

  if (!trimmedUrl) {
    return DEFAULT_BASE_URL;
  }

  const candidate = trimmedUrl.includes("://")
    ? trimmedUrl
    : `http://${trimmedUrl}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch (error) {
    throw new Error(`Invalid URL provided: ${rawBaseUrl}`);
  }

  if (url.pathname === "/" || url.pathname === "") {
    url.pathname = "/mcp";
  }

  url.pathname = url.pathname.replace(/\/+$/, "") || "/";

  return url.toString();
}

/**
 * MCP Bridge Server that connects to an HTTP MCP server and
 * exposes its capabilities as an MCP server using stdio transport
 */
class HttpMcpBridgeServer {
  private transport: StreamableHTTPClientTransport;
  private server: Server;
  private client: Client;
  private baseUrl: string;
  private token: string | null;
  private project: string | null;

  constructor(options: { baseUrl: string; project?: string | null }) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.token = process.env.MCPR_TOKEN || null;
    this.project = options.project ?? null;
    if (this.project) {
      this.project = this.project.trim();
    }

    const headers: Record<string, string> = {};
    if (this.token) {
      headers.authorization = `Bearer ${this.token}`;
    }
    if (this.project) {
      headers["x-mcpr-project"] = this.project;
    }

    this.transport = new StreamableHTTPClientTransport(new URL(this.baseUrl), {
      sessionId: undefined,
      requestInit: {
        headers,
      },
    });
    this.client = new Client({
      name: "Unknown Client",
      version: "0.0.1",
    });

    // Initialize the MCP server
    this.server = new Server(
      {
        name: SERVER_NAME,
        version: VERSION,
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
    this.server.onerror = (error) => console.error("[MCP Bridge Error]", error);
  }

  /**
   * Set up request handlers for the MCP server
   */
  private setupRequestHandlers(): void {
    // Initialize - Capture client info from the Initialize request
    this.server.setRequestHandler(InitializeRequestSchema, async (request) => {
      try {
        // Extract client name and set it in the HTTP client
        if (request.params.clientInfo && request.params.clientInfo.name) {
          const clientName = request.params.clientInfo.name;
          this.client = new Client({
            name: clientName,
            version: "0.0.1",
          });
          await this.client.connect(this.transport);
        }
        return {
          protocolVersion: request.params.protocolVersion,
          capabilities: {
            resources: {},
            tools: {},
            prompts: {},
          },
          serverInfo: {
            name: SERVER_NAME,
            version: VERSION,
          },
        };
      } catch (error: any) {
        // If already McpError, re-throw as-is to avoid wrapping
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Error during initialization: ${error.message}`,
        );
      }
    });

    // List Tools
    this.server.setRequestHandler(ListToolsRequestSchema, async (_request) => {
      try {
        const response = await this.client.listTools();
        return { tools: response.tools || [] };
      } catch (error: any) {
        // If already McpError, re-throw as-is to avoid wrapping
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Error listing tools: ${error.message}`,
        );
      }
    });

    // Call Tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const result = await this.client.callTool(
          {
            name: request.params.name,
            arguments: request.params.arguments || {},
          },
          undefined,
          {
            timeout: 60 * 60 * 1000, // 60分
            resetTimeoutOnProgress: true,
          },
        );
        return result as CallToolResult;
      } catch (error: any) {
        // If already McpError, re-throw as-is to avoid wrapping
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Error calling tool ${request.params.name}: ${error.message}`,
        );
      }
    });

    // List Resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      try {
        const response = await this.client.listResources();
        return { resources: response.resources || [] };
      } catch (error: any) {
        // If already McpError, re-throw as-is to avoid wrapping
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Error listing resources: ${error.message}`,
        );
      }
    });

    // List Resource Templates
    this.server.setRequestHandler(
      ListResourceTemplatesRequestSchema,
      async () => {
        // HTTP server doesn't explicitly expose resource templates
        // Return empty list for now
        return { resourceTemplates: [] };
      },
    );

    // Read Resource
    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        try {
          const resource = await this.client.readResource({
            uri: request.params.uri,
          });
          return resource as ReadResourceResult;
        } catch (error: any) {
          // If already McpError, re-throw as-is to avoid wrapping
          if (error instanceof McpError) {
            throw error;
          }
          throw new McpError(
            ErrorCode.InternalError,
            `Error reading resource ${request.params.uri}: ${error.message}`,
          );
        }
      },
    );

    // List Prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      try {
        const response = await this.client.listPrompts();
        return { prompts: response.prompts || [] };
      } catch (error: any) {
        // If already McpError, re-throw as-is to avoid wrapping
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Error listing prompts: ${error.message}`,
        );
      }
    });

    // Get Prompt
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      try {
        const result = await this.client.getPrompt({
          name: request.params.name,
          arguments: request.params.arguments || {},
        });
        return result as GetPromptResult;
      } catch (error: any) {
        // If already McpError, re-throw as-is to avoid wrapping
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Error getting prompt ${request.params.name}: ${error.message}`,
        );
      }
    });
  }

  /**
   * Start the MCP server with stdio transport
   */
  async start(): Promise<void> {
    try {
      // First check if the HTTP server is running
      // await this.testConnection();

      // Create and connect the stdio transport
      const transport = new StdioServerTransport();

      // Add error handling for stdin/stdout streams
      process.stdin.on("error", (err: Error) => {
        console.error("Stdin error:", err);
        process.exit(1);
      });

      process.stdout.on("error", (err: Error) => {
        console.error("Stdout error:", err);
        process.exit(1);
      });

      // StdioServerTransport doesn't support direct event handlers
      // We'll rely on the Server's error handler instead

      await this.server.connect(transport);
    } catch (error: any) {
      console.error("Failed to start MCP Bridge Server:", error.message);
      process.exit(1);
    }
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    try {
      await this.server.close();
    } catch (error) {
      console.error("Error stopping MCP Bridge Server:", error);
    }
  }

  /**
   * Test connection to the HTTP server
   */
  private async testConnection(): Promise<void> {
    try {
      // Check if the server is running with a timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      let response;
      try {
        const headers: Record<string, string> = {};
        if (this.token) {
          headers["Authorization"] = `Bearer ${this.token}`;
        }
        if (this.project) {
          headers["X-MCPR-Project"] = this.project;
        }

        const testUrl = new URL(this.baseUrl);
        testUrl.pathname = `${testUrl.pathname.replace(/\/+$/, "")}/api/test`;

        response = await fetch(testUrl, {
          signal: controller.signal,
          headers,
        }).finally(() => clearTimeout(timeoutId));
      } catch (fetchError: any) {
        if (fetchError.code === "ECONNREFUSED") {
          throw new Error(
            `Connection refused at ${this.baseUrl}. Make sure the MCP Router is running.`,
          );
        } else if (fetchError.name === "AbortError") {
          throw new Error(
            `Connection timed out after 5 seconds. The server at ${this.baseUrl} is not responding.`,
          );
        } else {
          throw new Error(
            `Failed to connect to ${this.baseUrl}: ${fetchError.message}`,
          );
        }
      }

      if (!response.ok) {
        const statusText = response.statusText
          ? ` (${response.statusText})`
          : "";
        throw new Error(
          `Server responded with status: ${response.status}${statusText}`,
        );
      }

      // Define the expected response type and handle parsing errors
      try {
        await response.json();
      } catch {
        throw new Error(
          `Failed to parse server response as JSON. Server may not be fully initialized.`,
        );
      }
    } catch (error: any) {
      console.error("Make sure the MCP Router is running");
      console.error(
        "If the server URL is different, specify it with the --url option",
      );
      console.error(
        "If authentication is required, set the MCPR_TOKEN environment variable",
      );
      throw error;
    }
  }
}
