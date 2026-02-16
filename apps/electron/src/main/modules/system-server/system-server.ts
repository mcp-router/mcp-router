import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import type { MCPServerManager } from "@/main/modules/mcp-server-manager/mcp-server-manager";
import type {
  ListServersInput,
  GetServerInput,
  AddServerInput,
  RemoveServerInput,
  ToggleServerInput,
  ListToolsInput,
  ServerSummary,
  ToolSummary,
} from "./system-server.types";

/**
 * MCP Server that exposes router management as MCP tools.
 * Allows agents to list, inspect, add, remove, and toggle MCP servers
 * programmatically through the standard MCP tool-calling interface.
 */
export class SystemServer {
  private server: Server;
  private serverManager: MCPServerManager;

  constructor(serverManager: MCPServerManager) {
    this.serverManager = serverManager;

    this.server = new Server(
      { name: "mcp-router-system", version: "1.0.0" },
      { capabilities: { tools: {} } },
    );

    this.registerHandlers();

    this.server.onerror = (error) => {
      console.error("[SystemServer Error]", error);
    };
  }

  /** Expose the underlying SDK Server for transport binding. */
  public getServer(): Server {
    return this.server;
  }

  // ---------------------------------------------------------------------------
  // Handler registration
  // ---------------------------------------------------------------------------

  private registerHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: SYSTEM_TOOLS,
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const args = (request.params.arguments ?? {}) as Record<string, unknown>;

      switch (toolName) {
        case "router_list_servers":
          return this.handleListServers(args as unknown as ListServersInput);
        case "router_get_server":
          return this.handleGetServer(args as unknown as GetServerInput);
        case "router_add_server":
          return this.handleAddServer(args as unknown as AddServerInput);
        case "router_remove_server":
          return this.handleRemoveServer(args as unknown as RemoveServerInput);
        case "router_toggle_server":
          return this.handleToggleServer(args as unknown as ToggleServerInput);
        case "router_list_tools":
          return this.handleListTools(args as unknown as ListToolsInput);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${toolName}`,
          );
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Tool implementations
  // ---------------------------------------------------------------------------

  private async handleListServers(input: ListServersInput) {
    const servers = this.serverManager.getServers();
    const statusFilter = input.status ?? "all";

    const results: ServerSummary[] = servers
      .filter((s) => statusFilter === "all" || s.status === statusFilter)
      .map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        serverType: s.serverType,
        disabled: s.disabled ?? false,
        autoStart: s.autoStart ?? false,
        errorMessage: s.errorMessage,
        description: s.description,
        projectId: s.projectId,
      }));

    return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
  }

  private async handleGetServer(input: GetServerInput) {
    const server = this.resolveServer(input.server);
    if (!server) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Server not found: ${input.server}`,
      );
    }

    // Return full config (strip runtime-only fields like logs)
    const detail = {
      id: server.id,
      name: server.name,
      status: server.status,
      serverType: server.serverType,
      command: server.command,
      args: server.args,
      remoteUrl: server.remoteUrl,
      env: server.env,
      disabled: server.disabled ?? false,
      autoStart: server.autoStart ?? false,
      description: server.description,
      errorMessage: server.errorMessage,
      projectId: server.projectId,
      toolPermissions: server.toolPermissions,
      tools: server.tools?.map((t) => ({
        name: t.name,
        description: t.description,
        enabled: t.enabled,
      })),
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(detail, null, 2) }] };
  }

  private async handleAddServer(input: AddServerInput) {
    // Validate required fields by server type
    if (input.serverType === "local" && !input.command) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "command is required for local servers",
      );
    }
    if (
      (input.serverType === "remote" ||
        input.serverType === "remote-streamable") &&
      !input.remoteUrl
    ) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "remoteUrl is required for remote servers",
      );
    }

    const newServer = this.serverManager.addServer({
      id: "", // repository generates the ID
      name: input.name,
      serverType: input.serverType,
      command: input.command,
      args: input.args,
      remoteUrl: input.remoteUrl,
      bearerToken: input.bearerToken,
      env: input.env ?? {},
      description: input.description,
      autoStart: input.autoStart ?? false,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { id: newServer.id, name: newServer.name, status: newServer.status },
            null,
            2,
          ),
        },
      ],
    };
  }

  private async handleRemoveServer(input: RemoveServerInput) {
    const server = this.resolveServer(input.server);
    if (!server) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Server not found: ${input.server}`,
      );
    }

    const removed = this.serverManager.removeServer(server.id);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ removed, id: server.id, name: server.name }),
        },
      ],
    };
  }

  private async handleToggleServer(input: ToggleServerInput) {
    const server = this.resolveServer(input.server);
    if (!server) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Server not found: ${input.server}`,
      );
    }

    const updated = this.serverManager.updateServer(server.id, {
      disabled: !input.enabled,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            id: server.id,
            name: server.name,
            disabled: updated?.disabled ?? !input.enabled,
          }),
        },
      ],
    };
  }

  private async handleListTools(input: ListToolsInput) {
    const results: ToolSummary[] = [];

    if (input.server) {
      // List tools for a specific server
      const server = this.resolveServer(input.server);
      if (!server) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Server not found: ${input.server}`,
        );
      }

      try {
        const tools = await this.serverManager.listServerTools(server.id);
        for (const tool of tools) {
          results.push({
            name: tool.name,
            description: tool.description,
            enabled: tool.enabled ?? true,
            serverName: server.name,
            serverId: server.id,
          });
        }
      } catch {
        // Server not running — return empty list with a note
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: `Server "${server.name}" must be running to list tools`,
                serverId: server.id,
                status: server.status,
              }),
            },
          ],
        };
      }
    } else {
      // List tools across all running servers
      const servers = this.serverManager.getServers();
      for (const server of servers) {
        if (server.status !== "running") continue;
        try {
          const tools = await this.serverManager.listServerTools(server.id);
          for (const tool of tools) {
            results.push({
              name: tool.name,
              description: tool.description,
              enabled: tool.enabled ?? true,
              serverName: server.name,
              serverId: server.id,
            });
          }
        } catch {
          // Skip servers that fail
        }
      }
    }

    return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Resolve a server by ID or name.
   */
  private resolveServer(idOrName: string) {
    const servers = this.serverManager.getServers();
    return (
      servers.find((s) => s.id === idOrName) ??
      servers.find((s) => s.name === idOrName)
    );
  }

  /**
   * Clean up resources.
   */
  public async shutdown(): Promise<void> {
    await this.server.close();
  }
}

// ---------------------------------------------------------------------------
// Tool definitions (MCP schema)
// ---------------------------------------------------------------------------

const SYSTEM_TOOLS = [
  {
    name: "router_list_servers",
    description:
      "List all MCP servers registered in the router with their status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["running", "stopped", "error", "all"],
          description: "Filter by server status. Defaults to 'all'.",
        },
      },
    },
  },
  {
    name: "router_get_server",
    description:
      "Get detailed information about a specific MCP server, including its configuration and tools.",
    inputSchema: {
      type: "object" as const,
      properties: {
        server: {
          type: "string",
          description: "Server ID or name.",
        },
      },
      required: ["server"],
    },
  },
  {
    name: "router_add_server",
    description:
      "Add a new MCP server to the router. Supports local (stdio), remote (SSE), and remote-streamable (HTTP) server types.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Display name for the server.",
        },
        serverType: {
          type: "string",
          enum: ["local", "remote", "remote-streamable"],
          description: "Server connection type.",
        },
        command: {
          type: "string",
          description:
            "Command to run (required for local servers, e.g. 'npx', 'node').",
        },
        args: {
          type: "array",
          items: { type: "string" },
          description: "Arguments for the command (local servers only).",
        },
        remoteUrl: {
          type: "string",
          description:
            "URL for remote or remote-streamable servers (e.g. 'http://localhost:3000/mcp').",
        },
        bearerToken: {
          type: "string",
          description:
            "Bearer token for authenticated remote servers.",
        },
        env: {
          type: "object",
          additionalProperties: { type: "string" },
          description: "Environment variables for the server process.",
        },
        description: {
          type: "string",
          description: "Human-readable description of the server.",
        },
        autoStart: {
          type: "boolean",
          description: "Whether to auto-start the server on app launch.",
        },
      },
      required: ["name", "serverType"],
    },
  },
  {
    name: "router_remove_server",
    description:
      "Remove an MCP server from the router. Stops it first if running.",
    inputSchema: {
      type: "object" as const,
      properties: {
        server: {
          type: "string",
          description: "Server ID or name.",
        },
      },
      required: ["server"],
    },
  },
  {
    name: "router_toggle_server",
    description:
      "Enable or disable an MCP server. Disabled servers won't auto-start and are excluded from aggregation.",
    inputSchema: {
      type: "object" as const,
      properties: {
        server: {
          type: "string",
          description: "Server ID or name.",
        },
        enabled: {
          type: "boolean",
          description: "true to enable, false to disable.",
        },
      },
      required: ["server", "enabled"],
    },
  },
  {
    name: "router_list_tools",
    description:
      "List all available MCP tools. Optionally filter by a specific server.",
    inputSchema: {
      type: "object" as const,
      properties: {
        server: {
          type: "string",
          description:
            "Server ID or name. If omitted, lists tools from all running servers.",
        },
      },
    },
  },
];
