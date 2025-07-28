import { createServer } from "http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { MCPAggregator } from "../mcp-aggregator.js";
import { ServeServerConfig } from "@mcp_router/shared";

/**
 * Executes the serve command, starting an HTTP server that accepts
 * Streamable HTTP MCP requests and forwards them to a stdio-based MCP server.
 */
export async function executeServe(args: string[] = []): Promise<void> {
  const options = parseArgs(args);

  // Create and start the Stdio MCP Bridge Server
  const bridgeServer = new StdioMcpBridgeServer(options);
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
function parseArgs(args: string[]): {
  port: number;
  servers: ServeServerConfig[];
  verbose?: boolean;
  token?: string;
} {
  const options = {
    port: 3283,
    servers: [] as ServeServerConfig[],
    verbose: false,
    token: undefined as string | undefined,
  };

  let i = 0;
  while (i < args.length) {
    if (args[i] === "--port" && i + 1 < args.length) {
      options.port = parseInt(args[i + 1], 10);
      i += 2;
    } else if (args[i] === "--token" && i + 1 < args.length) {
      options.token = args[i + 1];
      i += 2;
    } else if (args[i] === "--verbose" || args[i] === "-v") {
      options.verbose = true;
      i++;
    } else if (args[i] === "--server" && i + 3 < args.length) {
      // --server <id> <name> <command> [args...]
      const id = args[i + 1];
      const name = args[i + 2];
      const command = args[i + 3];
      i += 4;

      // Collect args until next --server flag or end
      const serverArgs: string[] = [];
      while (i < args.length && args[i] !== "--server") {
        serverArgs.push(args[i]);
        i++;
      }

      options.servers.push({ id, name, command, args: serverArgs });
    } else if (args[i] === "--") {
      // Legacy single server mode: everything after -- is the command and its arguments
      const command = args[i + 1];
      const serverArgs = args.slice(i + 2);
      options.servers.push({
        id: "default",
        name: "default",
        command,
        args: serverArgs,
      });
      break;
    } else if (!options.servers.length) {
      // Legacy single server mode: first non-option argument is the command
      const command = args[i];
      const serverArgs = args.slice(i + 1);
      options.servers.push({
        id: "default",
        name: "default",
        command,
        args: serverArgs,
      });
      break;
    } else {
      throw new Error(`Unexpected argument: ${args[i]}`);
    }
  }

  if (options.servers.length === 0) {
    throw new Error(
      "No servers specified. Usage:\n" +
        "  Single server: mcpr-cli serve [--port <port>] [--token <token>] [--verbose] <command> [args...]\n" +
        "  Multiple servers: mcpr-cli serve [--port <port>] [--token <token>] [--verbose] --server <id> <name> <command> [args...] [--server ...]",
    );
  }

  return options;
}

/**
 * HTTP to Stdio MCP Bridge Server
 *
 * This class creates an HTTP server that accepts Streamable HTTP MCP requests
 * and forwards them to one or more stdio-based MCP server processes using the MCPAggregator.
 */
class StdioMcpBridgeServer {
  private httpServer: ReturnType<typeof createServer> | null = null;
  private aggregator: MCPAggregator | null = null;
  private clients: Map<string, Client> = new Map();
  private isReady = false;

  constructor(
    private options: {
      port: number;
      servers: ServeServerConfig[];
      verbose?: boolean;
      token?: string;
    },
  ) {}

  /**
   * Starts the HTTP server and connects to the stdio MCP servers
   */
  async start(): Promise<void> {
    // Create the aggregator
    this.aggregator = new MCPAggregator();

    // Create HTTP server and start listening immediately
    this.httpServer = createServer(async (req, res) => {
      // Check authentication if token is configured
      if (this.options.token) {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              error: {
                code: -32001,
                message: "Unauthorized: Missing or invalid Bearer token",
              },
              id: null,
            }),
          );
          return;
        }

        const providedToken = authHeader.substring(7); // Remove "Bearer " prefix
        if (providedToken !== this.options.token) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              error: {
                code: -32001,
                message: "Unauthorized: Invalid token",
              },
              id: null,
            }),
          );
          return;
        }
      }

      if (!this.isReady) {
        // Return a fake response while servers are starting up
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32002,
              message: "MCP servers are still initializing",
            },
            id: null,
          }),
        );
        return;
      }

      // Get the aggregator's server and transport
      const mcpServer = this.aggregator!.getServer();
      const transport = new StreamableHTTPServerTransport({
        // Stateless server - no session ID needed
        sessionIdGenerator: undefined,
      });
      mcpServer.connect(transport);

      await transport.handleRequest(req, res);
    });

    // Start listening on all network interfaces (0.0.0.0)
    this.httpServer.listen(this.options.port, "0.0.0.0", () => {
      console.error(
        `HTTP MCP Aggregator Server listening on 0.0.0.0:${this.options.port}`,
      );
      if (this.options.token) {
        console.error(`Authentication enabled with Bearer token`);
      }
      console.error(`Starting ${this.options.servers.length} MCP server(s)...`);
    });

    // Start all stdio MCP server processes in the background
    this.startStdioServers()
      .then(() => {
        this.isReady = true;
        console.error("All MCP servers connected and ready!");
        console.error(
          `Aggregating ${this.options.servers.length} MCP server(s):`,
        );
        for (const server of this.options.servers) {
          console.error(
            `  - ${server.name} (${server.id}): ${server.command} ${server.args.join(" ")}`,
          );
        }
      })
      .catch((error) => {
        console.error("Failed to start MCP servers:", error);
        process.exit(1);
      });
  }

  /**
   * Stops the server and cleans up resources
   */
  async stop(): Promise<void> {
    console.error("Stopping HTTP MCP Aggregator Server...");

    if (this.httpServer) {
      this.httpServer.close();
    }

    // Close all client connections
    for (const [id, client] of this.clients) {
      try {
        await client.close();
      } catch (error) {
        console.error(`Error closing client ${id}:`, error);
      }
    }
  }

  /**
   * Starts all stdio MCP server processes and registers them with the aggregator
   */
  private async startStdioServers(): Promise<void> {
    const startPromises = this.options.servers.map(async (serverConfig) => {
      try {
        // Create stdio transport (it will spawn the process internally)
        const transport = new StdioClientTransport({
          command: serverConfig.command,
          args: serverConfig.args,
        });

        // Create MCP client
        const client = new Client(
          {
            name: `mcp-aggregator-client-${serverConfig.id}`,
            version: "0.1.0",
          },
          {
            capabilities: {},
          },
        );

        // Connect to the stdio server
        await client.connect(transport);

        // Store the client
        this.clients.set(serverConfig.id, client);

        // Register with aggregator
        this.aggregator!.registerClient(
          serverConfig.id,
          serverConfig.name,
          client,
        );

        if (this.options.verbose) {
          console.error(
            `Connected to server: ${serverConfig.name} (${serverConfig.id})`,
          );
        }
      } catch (error) {
        console.error(
          `Failed to start server ${serverConfig.name} (${serverConfig.id}):`,
          error,
        );
        throw error;
      }
    });

    await Promise.all(startPromises);
  }
}
