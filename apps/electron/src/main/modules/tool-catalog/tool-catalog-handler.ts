import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import {
  AGGREGATOR_SERVER_NAME,
  MCPServer,
  MCPTool,
  UNASSIGNED_PROJECT_ID,
} from "@mcp_router/shared";
import type {
  DetailLevel,
  ServerInfo,
  CategoryInfo,
  ToolCapabilitiesResponse,
} from "@mcp_router/shared";
import { TokenValidator } from "@/main/modules/mcp-server-runtime/token-validator";
import { RequestHandlerBase } from "@/main/modules/mcp-server-runtime/request-handler-base";
import { getProjectService } from "@/main/modules/projects/projects.service";
import { ToolCatalogService } from "./tool-catalog.service";
import { transformResourceLinksInResult } from "@/main/utils/uri-utils";
import { ReconnectingMCPClient } from "@/main/modules/mcp-server-manager/reconnecting-mcp-client";

export const META_TOOLS: MCPTool[] = [
  {
    name: "tool_discovery",
    description: `Search for available tools across all connected servers.

You have access to 200+ tools across multiple servers, but they are NOT listed directly to save context space.

WHEN TO USE:
- When you don't know which tool to use
- When searching for tools by keyword or capability
- When exploring what's available

DIRECT ACCESS: If you already know the server and tool name, skip discovery and use tool_execute directly with 'serverName:toolName'.

EXAMPLE QUERIES:
- ["send", "slack", "message"] → Slack messaging tools
- ["github", "pull", "request"] → GitHub PR tools
- ["read", "file"] → File reading tools
- ["calendar", "events"] → Calendar tools

PARAMETERS:
- query (required): Keywords array describing functionality needed
- detailLevel (optional): "minimal" | "summary" | "full" (default: summary)
- maxResults (optional): Max results to return (default: 10, max: 100)
- category (optional): Filter by category from tool_capabilities
- context (optional): Your current task context to improve relevance`,
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "array",
          items: { type: "string" },
          description: "Keywords describing the functionality you need.",
        },
        detailLevel: {
          type: "string",
          enum: ["minimal", "summary", "full"],
          description:
            "Response detail level. minimal=~5 tokens/tool, summary=~20, full=~100+",
        },
        maxResults: {
          type: "number",
          description: "Maximum results (default: 10, max: 100).",
        },
        category: {
          type: "string",
          description:
            "Filter by category (use tool_capabilities to see categories).",
        },
        context: {
          type: "string",
          description: "Your current task context to improve relevance.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "tool_execute",
    description: `Execute a tool using its toolKey.

TOOLKEY FORMAT: 'serverName:toolName' (e.g., 'slack:channels_list', 'imessage:send')

DIRECT ACCESS: If you know the server and tool name, use the toolKey directly without discovery.
DISCOVERY: If unsure which tool to use, call tool_discovery first to search.

PARAMETERS:
- toolKey (required): Format is 'serverName:toolName' (e.g., 'notion:search', 'gmail:search_gmail_messages')
  - Server names are case-insensitive ('Slack:send' and 'slack:send' both work)
- arguments (required): Tool-specific parameters as JSON object

ERROR RECOVERY:
- "Server not found" → Use tool_capabilities to see available servers
- "Tool not found" → Use tool_discovery to search for the tool

FORMATS:
- 'serverName:toolName' (friendly): slack:channels_list, imessage:send
- 'serverId:toolName' (stable): Use if server name is ambiguous or for long-lived automation

TIP: Semantic toolKeys never expire. Once you know 'slack:channels_list', you can use it forever.`,
    inputSchema: {
      type: "object",
      properties: {
        toolKey: {
          type: "string",
          description:
            "Tool identifier in 'serverName:toolName' format (e.g., 'slack:channels_list').",
        },
        arguments: {
          type: "object",
          description: "Arguments to pass to the tool.",
        },
      },
      required: ["toolKey"],
    },
  },
  {
    name: "tool_capabilities",
    description: `Browse available tool categories and servers WITHOUT consuming context.

Use this for high-level exploration:
- "What kinds of tools are available?"
- "What can the GitHub server do?"
- "Show me messaging capabilities"

Returns categories with tool counts and example operations.
Does NOT return executable toolKeys—use tool_discovery for that.

WORKFLOW:
- DIRECT: If you know the tool → tool_execute('serverName:toolName')
- EXPLORE: tool_capabilities → tool_discovery → tool_execute`,
    inputSchema: {
      type: "object",
      properties: {
        server: {
          type: "string",
          description: "Filter to a specific server (e.g., 'github', 'slack').",
        },
        category: {
          type: "string",
          description: "Filter to a specific category.",
        },
      },
      required: [],
    },
  },
];

// Internal dependency injection type for handler initialization
// eslint-disable-next-line custom/no-scattered-types
type ToolCatalogHandlerDeps = {
  servers: ReadonlyMap<string, MCPServer>;
  clients: ReadonlyMap<string, ReconnectingMCPClient>;
  serverStatusMap: ReadonlyMap<string, boolean>;
  toolCatalogService: ToolCatalogService;
};

/**
 * Handles tool_discovery and tool_execute meta-tools.
 */
export class ToolCatalogHandler extends RequestHandlerBase {
  private servers: ReadonlyMap<string, MCPServer>;
  private clients: ReadonlyMap<string, ReconnectingMCPClient>;
  private serverStatusMap: ReadonlyMap<string, boolean>;
  private toolCatalogService: ToolCatalogService;
  private lowerCaseNameToIdMap: Map<string, string> = new Map();

  constructor(tokenValidator: TokenValidator, deps: ToolCatalogHandlerDeps) {
    super(tokenValidator);
    this.servers = deps.servers;
    this.clients = deps.clients;
    this.serverStatusMap = deps.serverStatusMap;
    this.toolCatalogService = deps.toolCatalogService;
    this.rebuildNameLookup(); // Build initial name lookup
  }

  /**
   * Rebuild the case-insensitive server name lookup map.
   * Called on construction and when servers change.
   */
  private rebuildNameLookup(): void {
    this.lowerCaseNameToIdMap.clear();
    for (const [id, server] of this.servers) {
      const lowerName = server.name.toLowerCase();
      if (this.lowerCaseNameToIdMap.has(lowerName)) {
        console.warn(
          `[ToolCatalog] Server name collision: "${server.name}" - use serverId:toolName for disambiguation`,
        );
      }
      // First one wins (deterministic)
      if (!this.lowerCaseNameToIdMap.has(lowerName)) {
        this.lowerCaseNameToIdMap.set(lowerName, id);
      }
    }
  }

  /**
   * Case-insensitive O(1) server name lookup.
   */
  private getServerIdByName(name: string): string | undefined {
    return this.lowerCaseNameToIdMap.get(name.toLowerCase());
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
    this.rebuildNameLookup();
    // Split on FIRST colon only (tool names may contain colons)
    const colonIndex = toolKey.indexOf(":");
    if (colonIndex <= 0) {
      throw this.createActionableError(
        ErrorCode.InvalidRequest,
        "TOOLKEY_INVALID",
        `Invalid toolKey format: ${toolKey}`,
        {
          action: "Use format 'serverName:toolName'",
          steps: [
            "Use format 'serverName:toolName' (e.g., 'slack:channels_list')",
            "Use tool_capabilities to verify server names",
            "Use tool_discovery to search for tools",
          ],
          suggestedTools: ["tool_capabilities", "tool_discovery"],
        },
      );
    }

    const name = toolKey.slice(0, colonIndex);
    const toolName = toolKey.slice(colonIndex + 1); // Everything after first colon

    if (!toolName) {
      throw this.createActionableError(
        ErrorCode.InvalidRequest,
        "TOOLKEY_INVALID",
        `Invalid toolKey format: ${toolKey} (missing tool name)`,
        {
          action: "Provide a tool name after the colon",
          steps: [
            "Use format 'serverName:toolName' (e.g., 'slack:channels_list')",
            "Use tool_discovery to find available tools",
          ],
          suggestedTools: ["tool_discovery"],
        },
      );
    }

    // Try as serverId first (direct UUID lookup)
    if (this.servers.get(name)) {
      return { serverId: name, toolName };
    }

    // Try as serverName (case-insensitive lookup)
    const serverId = this.getServerIdByName(name);
    if (serverId) {
      return { serverId, toolName };
    }

    // Neither worked
    throw this.createActionableError(
      ErrorCode.InvalidRequest,
      "SERVER_NOT_FOUND",
      `Server '${name}' not found`,
      {
        action: "Verify the server name",
        steps: [
          "Use tool_capabilities to see available servers",
          "Server names are case-INSENSITIVE ('Slack' and 'slack' both work)",
          "Use serverId:toolName for unambiguous access",
        ],
        suggestedTools: ["tool_capabilities"],
      },
    );
  }

  private buildToolKey(serverId: string, toolName: string): string {
    // Return semantic serverName:toolName format (no UUID, no TTL)
    const server = this.servers.get(serverId);
    const serverName = server?.name || serverId;
    return `${serverName}:${toolName}`;
  }

  /**
   * Create an actionable error with recovery hints.
   */
  private createActionableError(
    code: ErrorCode,
    type: string,
    message: string,
    recovery: {
      action: string;
      steps: string[];
      hint?: string;
      suggestedTools?: string[];
    },
  ): McpError {
    const errorData = {
      errorType: type,
      recoveryAction: recovery.action,
      recoverySteps: recovery.steps,
      hint: recovery.hint,
      suggestedTools: recovery.suggestedTools,
    };

    // Include recovery info in the message for LLMs that don't parse error data
    const fullMessage = `${message}\n\nRECOVERY: ${recovery.action}\nSTEPS:\n${recovery.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}${recovery.hint ? `\n\nHINT: ${recovery.hint}` : ""}`;

    const error = new McpError(code, fullMessage);
    (error as any).data = errorData;
    return error;
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
      typeof args.maxResults === "number" ? args.maxResults : 10;
    const detailLevel: DetailLevel =
      args.detailLevel === "minimal" || args.detailLevel === "full"
        ? args.detailLevel
        : "summary";
    const category =
      typeof args.category === "string" ? args.category : undefined;

    const optimization = this.getProjectOptimization(projectId);

    return await this.executeWithHooksAndLogging(
      "tools/discovery",
      { query, context, maxResults, detailLevel, category },
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
          { query, context, maxResults, detailLevel, category },
          {
            projectId,
            allowedServerIds,
            // Catalog mode is always enabled - meta-tools are the default interface
            toolCatalogEnabled: true,
          },
        );

        // Format results based on detail level
        const results = response.results.map((result) => {
          const toolKey = this.buildToolKey(result.serverId, result.toolName);

          // Minimal: just identification
          const minimal = {
            toolKey,
            toolName: result.toolName,
            serverName: result.serverName,
          };

          if (detailLevel === "minimal") {
            return minimal;
          }

          // Summary: add description, relevance, and schema for immediate execution
          const summary = {
            ...minimal,
            description: result.description?.substring(0, 150),
            relevance: result.relevance,
            inputSchema: result.inputSchema, // Include schema so agents can execute immediately
            serverId: result.serverId, // Include for disambiguation
          };

          if (detailLevel === "summary") {
            return summary;
          }

          // Full: everything
          return {
            ...summary,
            description: result.description,
            serverId: result.serverId,
            explanation: result.explanation,
            outputSchema: result.outputSchema,
            annotations: result.annotations,
          };
        });

        // Build response with metadata (no expiration - semantic keys are stable)
        const responsePayload = {
          tools: results,
          metadata: {
            query,
            detailLevel,
            resultCount: results.length,
            hint: "Semantic toolKeys (serverName:toolName) never expire. Use them directly in future sessions.",
          },
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(responsePayload, null, 2),
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
      throw this.createActionableError(
        ErrorCode.InvalidRequest,
        "SERVER_NOT_FOUND",
        `Unknown server: ${serverId}`,
        {
          action: "Verify the server exists",
          steps: [
            "Call tool_capabilities to see available servers",
            "Call tool_discovery to find tools on available servers",
            "Use a toolKey from the discovery results",
          ],
          suggestedTools: ["tool_capabilities", "tool_discovery"],
        },
      );
    }

    const serverName = server.name || serverId;

    if (!this.tokenValidator.hasServerAccess(validatedToken, serverId)) {
      throw this.createActionableError(
        ErrorCode.InvalidRequest,
        "ACCESS_DENIED",
        "Token does not have access to this server",
        {
          action: "Check your access permissions",
          steps: [
            "Use tool_capabilities to see servers you have access to",
            "Call tool_discovery to find accessible tools",
            "Contact your administrator if you need access to additional servers",
          ],
          suggestedTools: ["tool_capabilities"],
        },
      );
    }

    if (!this.toolCatalogService.matchesProject(server, projectId)) {
      throw this.createActionableError(
        ErrorCode.InvalidRequest,
        "PROJECT_MISMATCH",
        "Tool not available for the selected project",
        {
          action: "Use tools available in your current project",
          steps: [
            "Call tool_discovery to find tools in your current project",
            "Switch to a different project if you need this tool",
            "Check if the server is assigned to your project",
          ],
          suggestedTools: ["tool_discovery"],
        },
      );
    }

    if (server.toolPermissions && server.toolPermissions[toolName] === false) {
      throw this.createActionableError(
        ErrorCode.InvalidRequest,
        "TOOL_DISABLED",
        `Tool "${toolName}" is disabled for this server`,
        {
          action: "Use an alternative tool or request access",
          steps: [
            "This tool has been disabled by an administrator",
            "Call tool_discovery to find similar tools that are enabled",
            "Contact your administrator if you need this specific tool",
          ],
          suggestedTools: ["tool_discovery"],
        },
      );
    }

    const client = this.clients.get(serverId);
    if (!client) {
      throw this.createActionableError(
        ErrorCode.InvalidRequest,
        "SERVER_DISCONNECTED",
        `Server ${serverName} is not connected`,
        {
          action: "Wait for server to reconnect or use alternative",
          steps: [
            "The server may be temporarily unavailable",
            "Try again in a few moments",
            "Call tool_capabilities to see currently connected servers",
          ],
          hint: "Server connections are managed automatically and will reconnect when available",
          suggestedTools: ["tool_capabilities"],
        },
      );
    }

    if (!this.serverStatusMap.get(serverName)) {
      throw this.createActionableError(
        ErrorCode.InvalidRequest,
        "SERVER_NOT_RUNNING",
        `Server ${serverName} is not running`,
        {
          action: "Wait for server to start or use alternative",
          steps: [
            "The server may be starting up or temporarily stopped",
            "Try again in a few moments",
            "Call tool_capabilities to see currently running servers",
          ],
          suggestedTools: ["tool_capabilities"],
        },
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
        const result = await client.getClient().callTool(
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
        // Transform resource links to use router's namespace
        return transformResourceLinksInResult(result, serverName);
      },
      { serverId },
    );
  }

  /**
   * Handle tool_capabilities request.
   * Returns high-level overview of available categories and servers.
   */
  public async handleToolCapabilities(request: any): Promise<any> {
    const token = request.params._meta?.token as string | undefined;
    const projectId = this.normalizeProjectId(request.params._meta?.projectId);
    const { clientId, token: validatedToken } = this.requireValidToken(token);

    const args = request.params.arguments || {};
    const filterServer =
      typeof args.server === "string" ? args.server : undefined;
    const filterCategory =
      typeof args.category === "string" ? args.category : undefined;

    return await this.executeWithHooksAndLogging(
      "tools/capabilities",
      { server: filterServer, category: filterCategory },
      clientId,
      AGGREGATOR_SERVER_NAME,
      "ToolCapabilities",
      async () => {
        const allowedServerIds = new Set<string>();
        for (const serverId of this.servers.keys()) {
          if (this.tokenValidator.hasServerAccess(validatedToken, serverId)) {
            allowedServerIds.add(serverId);
          }
        }

        // Collect tools to analyze
        const { servers, clients, serverStatusMap } = this.toolCatalogService
          .getServerManager()
          .getMaps();

        const categoryMap = new Map<
          string,
          { tools: string[]; count: number; description: string }
        >();
        let totalTools = 0;

        // Build list of servers to query
        const serversToQuery: Array<{
          serverId: string;
          server: MCPServer;
          serverName: string;
          client: ReconnectingMCPClient;
        }> = [];

        for (const [serverId, server] of servers.entries()) {
          if (!allowedServerIds.has(serverId)) continue;
          if (!this.toolCatalogService.matchesProject(server, projectId))
            continue;
          if (
            filterServer &&
            server.name !== filterServer &&
            serverId !== filterServer
          )
            continue;

          const serverName = server.name || serverId;
          const client = clients.get(serverId);
          const isRunning = serverStatusMap.get(serverName) && !!client;

          if (isRunning && client) {
            serversToQuery.push({ serverId, server, serverName, client });
          }
        }

        // Parallelize listTools() calls with Promise.allSettled()
        const toolResponses = await Promise.allSettled(
          serversToQuery.map(
            async ({ serverId, server, serverName, client }) => {
              const toolResponse = await client.getClient().listTools();
              return {
                serverId,
                server,
                serverName,
                tools: toolResponse?.tools ?? [],
              };
            },
          ),
        );

        // Process results
        const serverInfos: ServerInfo[] = [];

        // First, add servers that were queried (running)
        for (let i = 0; i < serversToQuery.length; i++) {
          const { serverId, server, serverName } = serversToQuery[i];
          const result = toolResponses[i];

          const serverCategories = new Set<string>();
          let serverToolCount = 0;

          if (result.status === "fulfilled") {
            const tools = result.value.tools;

            for (const tool of tools) {
              if (server.toolPermissions?.[tool.name] === false) continue;

              serverToolCount++;
              totalTools++;

              // Infer category from server name first, then tool name/description
              const category = this.inferCategory(
                serverName,
                tool.name,
                tool.description || "",
              );
              serverCategories.add(category);

              if (!filterCategory || category === filterCategory) {
                if (!categoryMap.has(category)) {
                  categoryMap.set(category, {
                    tools: [],
                    count: 0,
                    description: this.getCategoryDescription(category),
                  });
                }
                const cat = categoryMap.get(category)!;
                cat.count++;
                if (cat.tools.length < 3) {
                  // Keep only 3 examples
                  cat.tools.push(tool.name);
                }
              }
            }
          } else {
            console.error(
              `[ToolCapabilities] Failed to list tools from ${serverName}:`,
              result.reason,
            );
          }

          serverInfos.push({
            name: serverName,
            serverId,
            toolCount: serverToolCount,
            status: "running",
            categories: Array.from(serverCategories),
          });
        }

        // Add stopped servers (those not in serversToQuery but match filters)
        for (const [serverId, server] of servers.entries()) {
          if (!allowedServerIds.has(serverId)) continue;
          if (!this.toolCatalogService.matchesProject(server, projectId))
            continue;
          if (
            filterServer &&
            server.name !== filterServer &&
            serverId !== filterServer
          )
            continue;

          const serverName = server.name || serverId;
          const client = clients.get(serverId);
          const isRunning = serverStatusMap.get(serverName) && !!client;

          // Only add if not already added (i.e., it was stopped)
          if (!isRunning) {
            serverInfos.push({
              name: serverName,
              serverId,
              toolCount: 0,
              status: "stopped",
              categories: [],
            });
          }
        }

        const categories: CategoryInfo[] = Array.from(categoryMap.entries())
          .map(([name, data]) => ({
            name,
            description: data.description,
            toolCount: data.count,
            examples: data.tools,
          }))
          .sort((a, b) => b.toolCount - a.toolCount);

        const response: ToolCapabilitiesResponse = {
          totalTools,
          categories,
          servers: serverInfos.sort((a, b) => b.toolCount - a.toolCount),
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      },
    );
  }

  /**
   * Infer category from tool name and description.
   */
  private inferCategory(
    serverName: string,
    toolName: string,
    description: string,
  ): string {
    const lowerServerName = serverName.toLowerCase();

    // Primary signal: server name (most reliable)
    const serverCategoryMap: Record<string, string> = {
      slack: "messaging",
      discord: "messaging",
      teams: "messaging",
      imessage: "messaging",
      github: "github",
      gitlab: "github",
      bitbucket: "github",
      gmail: "email",
      outlook: "email",
      calendar: "calendar",
      notion: "notes",
      obsidian: "notes",
      evernote: "notes",
      figma: "design",
      supabase: "database",
      postgres: "database",
      mysql: "database",
      mongodb: "database",
      filesystem: "file_operations",
      git: "git",
    };

    // Check if server name matches or contains a known service
    for (const [service, category] of Object.entries(serverCategoryMap)) {
      if (lowerServerName.includes(service)) {
        return category;
      }
    }

    // Secondary signal: tool name and description patterns (more specific patterns)
    const text = `${toolName} ${description}`.toLowerCase();

    const categoryPatterns: [string, RegExp][] = [
      // More specific patterns to avoid false positives
      ["github", /\bgithub\b|pull.?request|create_issue|list_repos/],
      ["git", /\bgit\b|commit|branch|merge|clone|checkout/],
      ["email", /\bemail\b|\bgmail\b|\binbox\b|send.*mail/],
      ["calendar", /\bcalendar\b|\bevent\b|schedule|meeting|appointment/],
      ["messaging", /\bslack\b|\bchannel\b|send.*message|chat|dm\b/],
      ["database", /\bdatabase\b|\bsql\b|\bquery\b.*table|\brecord\b/],
      ["file_operations", /\bfile\b|\bdirectory\b|\bfolder\b|\bpath\b/],
      ["shell", /\bshell\b|\bbash\b|\bterminal\b|\bexec\b/],
      ["auth", /\bauth\b|\blogin\b|\bpassword\b|\bcredential\b/],
    ];

    for (const [category, pattern] of categoryPatterns) {
      if (pattern.test(text)) {
        return category;
      }
    }

    return "other";
  }

  /**
   * Get description for a category.
   */
  private getCategoryDescription(category: string): string {
    const descriptions: Record<string, string> = {
      file_operations: "Read, write, and manipulate files and directories",
      git: "Version control operations (commit, branch, merge)",
      github: "GitHub-specific operations (issues, PRs, repos)",
      messaging: "Send and receive messages (Slack, iMessage, chat)",
      calendar: "Calendar and scheduling operations",
      email: "Email sending and management",
      database: "Database queries and operations",
      notes: "Note-taking and documentation (Notion, Obsidian)",
      design: "Design tools (Figma, sketches)",
      api: "HTTP/REST API interactions",
      shell: "Shell command execution",
      search: "Search and find operations",
      auth: "Authentication and authorization",
      notification: "Push notifications and alerts",
      other: "Other tools",
    };
    return descriptions[category] || "Miscellaneous tools";
  }
}
