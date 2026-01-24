import { randomUUID } from "node:crypto";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  AGGREGATOR_SERVER_NAME,
  MCPServer,
  MCPTool,
  UNASSIGNED_PROJECT_ID,
} from "@mcp_router/shared";
import { TokenValidator } from "@/main/modules/mcp-server-runtime/token-validator";
import { RequestHandlerBase } from "@/main/modules/mcp-server-runtime/request-handler-base";
import { getProjectService } from "@/main/modules/projects/projects.service";
import { ToolCatalogService } from "./tool-catalog.service";

interface ToolKeyEntry {
  serverId: string;
  toolName: string;
  createdAt: number;
}

const TOOL_KEY_TTL_MS = 60 * 60 * 1000; // 1 hour

export const META_TOOLS: MCPTool[] = [
  {
    name: "tool_discovery",
    description:
      "Discover available tools across MCP servers. " +
      "Call this freely whenever you're unsure what tools exist or want to explore capabilities for your task. " +
      "It's lightweight and helps you understand your options before taking action.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "array",
          items: { type: "string" },
          description: "Keywords describing the functionality you need.",
        },
        context: {
          type: "string",
          description: "Your current task context to improve relevance.",
        },
        maxResults: {
          type: "number",
          description: "Maximum number of results to return.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "tool_execute",
    description:
      "Execute a discovered tool on an MCP server. " +
      "Use this after tool_discovery or when you know the exact toolKey.",
    inputSchema: {
      type: "object",
      properties: {
        toolKey: {
          type: "string",
          description:
            "Tool identifier (serverId:toolName) from tool_search results.",
        },
        arguments: {
          type: "object",
          description: "Arguments to pass to the tool.",
        },
      },
      required: ["toolKey"],
    },
  },
];

type ToolCatalogHandlerDeps = {
  servers: Map<string, MCPServer>;
  clients: Map<string, Client>;
  serverStatusMap: Map<string, boolean>;
  toolCatalogService: ToolCatalogService;
};

/**
 * Handles tool_discovery and tool_execute meta-tools.
 */
export class ToolCatalogHandler extends RequestHandlerBase {
  private servers: Map<string, MCPServer>;
  private clients: Map<string, Client>;
  private serverStatusMap: Map<string, boolean>;
  private toolCatalogService: ToolCatalogService;
  private toolKeyMap: Map<string, ToolKeyEntry> = new Map();

  constructor(tokenValidator: TokenValidator, deps: ToolCatalogHandlerDeps) {
    super(tokenValidator);
    this.servers = deps.servers;
    this.clients = deps.clients;
    this.serverStatusMap = deps.serverStatusMap;
    this.toolCatalogService = deps.toolCatalogService;
  }

  private normalizeProjectId(projectId: unknown): string | null {
    if (
      projectId === undefined ||
      projectId === null ||
      projectId === "" ||
      projectId === UNASSIGNED_PROJECT_ID
    ) {
      return null;
    }
    if (typeof projectId === "string") {
      return projectId;
    }
    return null;
  }

  private requireValidToken(token?: string): {
    token: string;
    clientId: string;
  } {
    if (!token || typeof token !== "string") {
      throw new McpError(ErrorCode.InvalidRequest, "Token is required");
    }

    const validation = this.tokenValidator.validateToken(token);
    if (!validation.isValid) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        validation.error || "Invalid token",
      );
    }

    return { token, clientId: validation.clientId || "unknownClient" };
  }

  private parseToolKey(toolKey: string): {
    serverId: string;
    toolName: string;
  } {
    // First, try to resolve from the temporary toolKey map
    const entry = this.toolKeyMap.get(toolKey);
    if (entry) {
      // Check TTL
      if (Date.now() - entry.createdAt > TOOL_KEY_TTL_MS) {
        this.toolKeyMap.delete(toolKey);
        throw new McpError(
          ErrorCode.InvalidRequest,
          `toolKey has expired: ${toolKey}`,
        );
      }
      return {
        serverId: entry.serverId,
        toolName: entry.toolName,
      };
    }

    // Fallback: parse as legacy format (serverId:toolName)
    const separatorIndex = toolKey.indexOf(":");
    if (separatorIndex <= 0 || separatorIndex >= toolKey.length - 1) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Invalid toolKey format: ${toolKey}`,
      );
    }

    return {
      serverId: toolKey.slice(0, separatorIndex),
      toolName: toolKey.slice(separatorIndex + 1),
    };
  }

  private buildToolKey(serverId: string, toolName: string): string {
    // Cleanup expired entries periodically
    this.cleanupExpiredToolKeys();

    // Generate a temporary UUID-based toolKey
    const toolKey = randomUUID();
    this.toolKeyMap.set(toolKey, {
      serverId,
      toolName,
      createdAt: Date.now(),
    });
    return toolKey;
  }

  private cleanupExpiredToolKeys(): void {
    const now = Date.now();
    for (const [key, entry] of this.toolKeyMap) {
      if (now - entry.createdAt > TOOL_KEY_TTL_MS) {
        this.toolKeyMap.delete(key);
      }
    }
  }

  private getProjectOptimization(projectId: string | null) {
    if (!projectId) {
      return undefined;
    }
    return getProjectService().getOptimization(projectId);
  }

  /**
   * Handle tool_discovery request.
   */
  public async handleToolDiscovery(request: any): Promise<any> {
    const token = request.params._meta?.token as string | undefined;
    const projectId = this.normalizeProjectId(request.params._meta?.projectId);
    const { clientId, token: validatedToken } = this.requireValidToken(token);

    const args = request.params.arguments || {};
    const rawQuery = args.query;
    const query = Array.isArray(rawQuery)
      ? rawQuery.filter((q): q is string => typeof q === "string")
      : [];
    if (query.length === 0) {
      throw new McpError(ErrorCode.InvalidRequest, "Query is required");
    }
    const context = typeof args.context === "string" ? args.context : undefined;
    const maxResults =
      typeof args.maxResults === "number" ? args.maxResults : undefined;

    const optimization = this.getProjectOptimization(projectId);

    return await this.executeWithHooksAndLogging(
      "tools/discovery",
      { query, context, maxResults },
      clientId,
      AGGREGATOR_SERVER_NAME,
      "ToolDiscovery",
      async () => {
        const allowedServerIds = new Set<string>();
        for (const serverId of this.servers.keys()) {
          if (this.tokenValidator.hasServerAccess(validatedToken, serverId)) {
            allowedServerIds.add(serverId);
          }
        }

        const response = await this.toolCatalogService.searchTools(
          { query, context, maxResults },
          {
            projectId,
            allowedServerIds,
            toolCatalogEnabled: !!optimization,
          },
        );

        const results = response.results.map((result) => ({
          toolKey: this.buildToolKey(result.serverId, result.toolName),
          toolName: result.toolName,
          serverName: result.serverName,
          description: result.description,
          relevance: result.relevance,
          explanation: result.explanation,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      },
    );
  }

  /**
   * Handle tool_execute request.
   */
  public async handleToolExecute(request: any): Promise<any> {
    const token = request.params._meta?.token as string | undefined;
    const projectId = this.normalizeProjectId(request.params._meta?.projectId);
    const { clientId, token: validatedToken } = this.requireValidToken(token);

    const args = request.params.arguments || {};
    const toolKey = typeof args.toolKey === "string" ? args.toolKey.trim() : "";
    if (!toolKey) {
      throw new McpError(ErrorCode.InvalidRequest, "toolKey is required");
    }

    const { serverId, toolName } = this.parseToolKey(toolKey);
    const server = this.servers.get(serverId);
    if (!server) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Unknown server: ${serverId}`,
      );
    }

    const serverName = server.name || serverId;

    if (!this.tokenValidator.hasServerAccess(validatedToken, serverId)) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        "Token does not have access to this server",
      );
    }

    if (!this.toolCatalogService.matchesProject(server, projectId)) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        "Tool not available for the selected project",
      );
    }

    if (server.toolPermissions && server.toolPermissions[toolName] === false) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Tool "${toolName}" is disabled for this server`,
      );
    }

    const client = this.clients.get(serverId);
    if (!client) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Server ${serverName} is not connected`,
      );
    }

    if (!this.serverStatusMap.get(serverName)) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Server ${serverName} is not running`,
      );
    }

    const toolArguments = args.arguments ?? {};

    return await this.executeWithHooksAndLogging(
      "tools/call",
      { toolKey, toolName, arguments: toolArguments },
      clientId,
      serverName,
      "ToolExecute",
      async () => {
        return await client.callTool(
          {
            name: toolName,
            arguments: toolArguments,
          },
          undefined,
          {
            timeout: 60 * 60 * 1000, // 60 minutes
            resetTimeoutOnProgress: true,
          },
        );
      },
      { serverId },
    );
  }
}
