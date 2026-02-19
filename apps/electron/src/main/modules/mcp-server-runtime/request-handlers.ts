import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { getRateLimiter } from "./rate-limiter";
import type { RateLimitResult } from "./rate-limiter";
import { getTaskRegistry, createNamespacedTaskId } from "./task-registry";
import type {
  CallToolRequest,
  CallToolResult,
  ListToolsResult,
  ListResourcesResult,
  ListResourceTemplatesResult,
  ReadResourceResult,
  GetPromptResult,
  Tool,
  Resource,
  ResourceTemplate,
  Prompt,
} from "@modelcontextprotocol/sdk/types.js";
import {
  MCPServer,
  UNASSIGNED_PROJECT_ID,
  prefixToolName,
  stripServerPrefix,
} from "@mcp_router/shared";
import type { ElicitationMode } from "@mcp_router/shared";
import {
  parseResourceUri,
  createResourceUri,
  createUriVariants,
  transformResourceLinksInResult,
} from "@/main/utils/uri-utils";
import { MCPServerManager } from "../mcp-server-manager/mcp-server-manager";
import { ReconnectingMCPClient } from "../mcp-server-manager/reconnecting-mcp-client";
import { ToolCatalogService } from "@/main/modules/tool-catalog/tool-catalog.service";
import { TokenValidator } from "./token-validator";
import { RequestHandlerBase } from "./request-handler-base";
import { getProjectService } from "@/main/modules/projects/projects.service";
import {
  ToolCatalogHandler,
  META_TOOLS,
} from "@/main/modules/tool-catalog/tool-catalog-handler";
import { getSharedConfigManager } from "@/main/infrastructure/shared-config-manager";
import { getElicitationManager } from "./elicitation-manager";
import { validateElicitationUrl } from "@/main/utils/url-validation-utils";
import { SystemServerService } from "@/main/modules/system-server/system-server.service";
import {
  estimateRequestTokens,
  estimateResponseTokens,
} from "./token-estimator";
import { getTokenBudgetTracker } from "./token-budget-tracker";

/** Tool with source server annotation for aggregated results */
type ToolWithSource = Tool & { sourceServer: string };

/** Resource with source server annotation for aggregated results */
type ResourceWithSource = Resource & { sourceServer: string };

/** Resource template with source server annotation for aggregated results */
type ResourceTemplateWithSource = ResourceTemplate & { sourceServer: string };

/** Prompt with source server annotation for aggregated results */
type PromptWithSource = Prompt & { sourceServer: string };

/** Elicitation create request shape (custom router protocol) */
interface ElicitationCreateRequest {
  params: {
    elicitationId?: string;
    mode?: ElicitationMode;
    message?: string;
    url?: string;
    schema?: unknown;
    _meta?: { sessionId?: string } & Record<string, unknown>;
  };
}

/** Elicitation create response shape */
interface ElicitationCreateResponse {
  method: string;
  params: Record<string, unknown>;
}

/**
 * Handles all request processing for the aggregator server
 */
export class RequestHandlers extends RequestHandlerBase {
  private originalProtocols: Map<string, string> = new Map();
  private toolNameToServerMap: Map<string, Map<string, string>> = new Map();
  private serverStatusMap: Map<string, boolean>;
  private servers: Map<string, MCPServer>;
  private clients: Map<string, ReconnectingMCPClient>;
  private serverNameToIdMap: Map<string, string>;
  private toolCatalogService: ToolCatalogService;
  private toolCatalogHandler: ToolCatalogHandler;

  constructor(
    serverManager: MCPServerManager,
    toolCatalogService?: ToolCatalogService,
  ) {
    const maps = serverManager.getMaps();
    const tokenValidator = new TokenValidator(maps.serverNameToIdMap);
    super(tokenValidator);

    // Get maps from server manager
    this.servers = maps.servers;
    this.clients = maps.clients;
    this.serverNameToIdMap = maps.serverNameToIdMap;
    this.serverStatusMap = maps.serverStatusMap;
    this.toolCatalogService =
      toolCatalogService || new ToolCatalogService(serverManager);

    // Create ToolCatalogHandler for tool_discovery and tool_execute
    this.toolCatalogHandler = new ToolCatalogHandler(tokenValidator, {
      servers: this.servers,
      clients: this.clients,
      serverStatusMap: this.serverStatusMap,
      toolCatalogService: this.toolCatalogService,
    });
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

  private matchesProject(
    server: MCPServer | undefined,
    projectId: string | null,
  ): boolean {
    const serverProject = server?.projectId ?? null;
    return projectId === null || serverProject === projectId;
  }

  private getProjectKey(projectId: string | null): string {
    return projectId ?? UNASSIGNED_PROJECT_ID;
  }

  private ensureToolMap(projectId: string | null): Map<string, string> {
    const key = this.getProjectKey(projectId);
    let map = this.toolNameToServerMap.get(key);
    if (!map) {
      map = new Map();
      this.toolNameToServerMap.set(key, map);
    }
    return map;
  }

  /**
   * Get project optimization setting.
   */
  private getProjectOptimization(projectId: string | null) {
    if (!projectId) {
      return undefined;
    }
    return getProjectService().getOptimization(projectId);
  }

  /**
   * Check if tool catalog is enabled for the given project.
   * Catalog mode is opt-in - when enabled, exposes meta-tools (tool_discovery,
   * tool_execute, tool_capabilities) instead of all tools directly.
   * This provides better token efficiency and works within client tool limits.
   */
  private isToolCatalogEnabled(): boolean {
    return getSharedConfigManager().getSettings().toolCatalogEnabled === true;
  }

  /**
   * Check if tool names should be prefixed with server name
   * @returns true if prefixToolNames setting is enabled (defaults to true)
   */
  private shouldPrefixToolNames(): boolean {
    const settings = getSharedConfigManager().getSettings();
    // Default to true if not explicitly set
    return settings.prefixToolNames !== false;
  }

  /**
   * Handle a request to list all tools from all servers
   */
  public async handleListTools(
    token?: string,
    projectIdInput?: unknown,
  ): Promise<ListToolsResult> {
    const clientId = this.getClientId(token);
    const projectId = this.normalizeProjectId(projectIdInput);

    return this.executeWithHooks("tools/list", {}, clientId, async () => {
      // Always include system tools (router_*) so agents can manage the router
      const systemTools = this.getSystemToolDefinitions().map((t) => ({
        ...t,
        sourceServer: "mcp-router-system",
      }));

      // If tool catalog is enabled, return META_TOOLS + system tools
      if (this.isToolCatalogEnabled()) {
        // Record meta-tool definitions for catalog savings calculation
        getTokenBudgetTracker().recordMetaToolDefinitions(META_TOOLS);
        return { tools: [...(META_TOOLS as Tool[]), ...systemTools] };
      }
      // Otherwise, return all tools from all servers (legacy behavior)
      // (system tools are already appended inside getAllToolsInternal)
      const allTools = await this.getAllToolsInternal(token, projectId);
      return { tools: allTools };
    });
  }

  /**
   * Handle a call to a specific tool
   */
  public async handleCallTool(
    request: CallToolRequest,
  ): Promise<CallToolResult> {
    const toolName = request.params.name;
    const projectId = this.normalizeProjectId(request.params._meta?.projectId);

    // --- Rate limiting ---
    const token = request.params._meta?.token as string | undefined;
    const clientId = this.getClientId(token);
    this.enforceRateLimit(`client:${clientId}`);

    // Always handle META_TOOLS (tool_discovery, tool_execute, tool_capabilities) regardless of catalog mode
    if (toolName === "tool_discovery") {
      return await this.toolCatalogHandler.handleToolDiscovery(request);
    }

    if (toolName === "tool_execute") {
      return await this.toolCatalogHandler.handleToolExecute(request);
    }

    if (toolName === "tool_capabilities") {
      return await this.toolCatalogHandler.handleToolCapabilities(request);
    }

    // Route router_* system tools directly to the SystemServer
    if (toolName.startsWith("router_")) {
      return this.handleSystemToolCall(
        toolName,
        (request.params.arguments as Record<string, unknown>) || {},
      );
    }

    // If tool catalog is enabled, only META_TOOLS are available
    if (this.isToolCatalogEnabled()) {
      throw new McpError(ErrorCode.InvalidRequest, `Unknown tool: ${toolName}`);
    }

    // Legacy behavior: route tool call to the appropriate server
    return await this.handleLegacyToolCall(request, toolName, projectId);
  }

  /**
   * Handle a request to list all resources from all servers
   */
  public async handleListResources(
    token?: string,
    projectIdInput?: unknown,
  ): Promise<ListResourcesResult> {
    const clientId = this.getClientId(token);
    const projectId = this.normalizeProjectId(projectIdInput);

    return this.executeWithHooks("resources/list", {}, clientId, async () => {
      const allResources = await this.getAllResourcesInternal(token, projectId);
      return { resources: allResources };
    });
  }

  /**
   * Get all resources from all servers (internal implementation)
   */
  private async getAllResourcesInternal(
    token?: string,
    projectId?: string | null,
  ): Promise<ResourceWithSource[]> {
    const normalizedProjectId = this.normalizeProjectId(projectId);
    const allResources: ResourceWithSource[] = [];
    const eligible = [];

    for (const [serverId, client] of this.clients.entries()) {
      const server = this.servers.get(serverId);
      const serverName = server?.name || serverId;
      const isRunning = this.serverStatusMap.get(serverName);

      if (!isRunning || !client) {
        continue;
      }

      if (!this.matchesProject(server, normalizedProjectId)) {
        continue;
      }

      // Check token access if provided
      if (token) {
        try {
          this.tokenValidator.validateTokenAndAccess(token, serverName);
        } catch {
          // Skip this server if token doesn't have access
          continue;
        }
      }

      eligible.push({ serverName, client });
    }

    const results = await Promise.allSettled(
      eligible.map(async ({ serverName, client }) => {
        const resources = await client.getClient().listResources();
        return { serverName, resources: resources.resources || [] };
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { serverName, resources } = result.value;
        for (const resource of resources) {
          // Store the original protocol if not already stored
          if (
            resource.uri &&
            !this.originalProtocols.has(resource.uri) &&
            resource.uri.includes("://")
          ) {
            const protocolPrefix = `${resource.uri.split("://")[0]}://`;
            this.originalProtocols.set(resource.uri, protocolPrefix);
          }

          const resourceWithSource: ResourceWithSource = {
            ...resource,
            sourceServer: serverName,
            uri: createResourceUri(serverName, resource.uri),
          };

          allResources.push(resourceWithSource);
        }
      } else {
        console.error(
          `[MCPServerManager] Failed to get resources:`,
          result.reason,
        );
      }
    }

    return allResources;
  }

  /**
   * Handle a request to list all resource templates
   */
  public async handleListResourceTemplates(
    token?: string,
    projectIdInput?: unknown,
  ): Promise<ListResourceTemplatesResult> {
    const clientId = this.getClientId(token);
    const projectId = this.normalizeProjectId(projectIdInput);

    return this.executeWithHooks(
      "resources/templates/list",
      {},
      clientId,
      async () => {
        const allTemplates: ResourceTemplateWithSource[] = [];
        const eligible = [];

        for (const [serverId, client] of this.clients.entries()) {
          const server = this.servers.get(serverId);
          const serverName = server?.name || serverId;
          const isRunning = this.serverStatusMap.get(serverName);

          if (!isRunning || !client) {
            continue;
          }

          if (!this.matchesProject(server, projectId)) {
            continue;
          }

          // Check token access if provided
          if (token) {
            try {
              this.tokenValidator.validateTokenAndAccess(token, serverName);
            } catch {
              // Skip this server if token doesn't have access
              continue;
            }
          }

          eligible.push({ serverName, client });
        }

        const results = await Promise.allSettled(
          eligible.map(async ({ serverName, client }) => {
            const templates = await client.getClient().listResourceTemplates();
            return { serverName, templates: templates.resourceTemplates || [] };
          }),
        );

        for (const result of results) {
          if (result.status === "fulfilled") {
            const { serverName, templates } = result.value;
            for (const template of templates) {
              const templateWithSource: ResourceTemplateWithSource = {
                ...template,
                sourceServer: serverName,
                uriTemplate: createResourceUri(
                  serverName,
                  template.uriTemplate,
                ),
              };

              allTemplates.push(templateWithSource);
            }
          } else {
            console.error(
              `[MCPServerManager] Failed to get resource templates:`,
              result.reason,
            );
          }
        }

        return { resourceTemplates: allTemplates };
      },
    );
  }

  /**
   * Read a specific resource by its URI
   */
  public async readResourceByUri(
    uri: string,
    token?: string,
    projectIdInput?: unknown,
  ): Promise<ReadResourceResult> {
    const clientId = this.getClientId(token);
    const projectId = this.normalizeProjectId(projectIdInput);

    // Parse the URI to get the server name and original URI
    const parsed = parseResourceUri(uri);
    if (!parsed) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Invalid resource URI format: ${uri}`,
      );
    }
    const { serverName, path: originalUri } = parsed;

    // Validate token access to the server if provided
    if (token) {
      this.tokenValidator.validateTokenAndAccess(token, serverName);
    }

    const serverId = this.getServerIdByName(serverName);
    if (!serverId) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Unknown server: ${serverName}`,
      );
    }

    const server = this.servers.get(serverId);
    if (!this.matchesProject(server, projectId)) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        "Resource not available for the selected project",
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

    return this.executeWithHooksAndLogging(
      "resources/read",
      { uri },
      clientId,
      serverName,
      "ReadResource",
      async () => {
        // Try different URI variants until one works
        const originalProtocol = this.originalProtocols.get(originalUri);
        const uriVariants = createUriVariants(
          serverName,
          originalUri,
          originalProtocol,
        );

        let lastError: unknown;
        for (const variantUri of uriVariants) {
          try {
            const result = await client
              .getClient()
              .readResource({ uri: variantUri.uri });

            // No display rules to apply for resources
            // Just return the result as is

            return result;
          } catch (error: unknown) {
            lastError = error;
            // Try the next variant
          }
        }

        // If all variants failed, throw the last error
        throw (
          lastError ||
          new McpError(
            ErrorCode.InvalidRequest,
            `Failed to read resource: ${originalUri}`,
          )
        );
      },
      { serverId },
    );
  }

  /**
   * Get all prompts from all servers (internal implementation)
   */
  public async getAllPromptsInternal(
    token?: string,
    projectIdInput?: unknown,
  ): Promise<PromptWithSource[]> {
    const projectId = this.normalizeProjectId(projectIdInput);
    const allPrompts: PromptWithSource[] = [];

    const eligible = [];
    for (const [serverId, client] of this.clients.entries()) {
      const server = this.servers.get(serverId);
      const serverName = server?.name || serverId;
      const isRunning = this.serverStatusMap.get(serverName);

      if (!isRunning || !client) {
        continue;
      }

      if (!this.matchesProject(server, projectId)) {
        continue;
      }

      // Check token access if provided
      if (token) {
        try {
          this.tokenValidator.validateTokenAndAccess(token, serverName);
        } catch {
          // Skip this server if token doesn't have access
          continue;
        }
      }

      eligible.push({ serverName, client });
    }

    const results = await Promise.allSettled(
      eligible.map(async ({ serverName, client }) => {
        const prompts = await client.getClient().listPrompts();
        return { serverName, prompts: prompts.prompts || [] };
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { serverName, prompts } = result.value;
        for (const prompt of prompts) {
          const promptWithSource: PromptWithSource = {
            ...prompt,
            sourceServer: serverName,
            // Prefix prompt name with server name to avoid collisions
            name: `${serverName}/${prompt.name}`,
          };

          allPrompts.push(promptWithSource);
        }
      } else {
        console.error(
          `[MCPServerManager] Failed to get prompts:`,
          result.reason,
        );
      }
    }

    return allPrompts;
  }

  /**
   * Get a specific prompt by name
   */
  public async getPromptByName(
    name: string,
    promptArgs?: Record<string, string>,
    token?: string,
    projectIdInput?: unknown,
  ): Promise<GetPromptResult> {
    const clientId = this.getClientId(token);
    const projectId = this.normalizeProjectId(projectIdInput);

    // Extract server name from the prefixed prompt name
    const parts = name.split("/");
    if (parts.length < 2) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Invalid prompt name format. Expected: serverName/promptName, got: ${name}`,
      );
    }

    const serverName = parts[0];
    const actualPromptName = parts.slice(1).join("/");

    // Validate token access to the server if provided
    if (token) {
      this.tokenValidator.validateTokenAndAccess(token, serverName);
    }

    const serverId = this.getServerIdByName(serverName);
    if (!serverId) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Unknown server: ${serverName}`,
      );
    }

    const server = this.servers.get(serverId);
    if (!this.matchesProject(server, projectId)) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        "Prompt not available for the selected project",
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

    return this.executeWithHooksAndLogging(
      "prompts/get",
      { name, arguments: promptArgs },
      clientId,
      serverName,
      "GetPrompt",
      async () => {
        const prompt = await client.getClient().getPrompt({
          name: actualPromptName,
          arguments: promptArgs,
        });

        // No display rules to apply for prompts
        // Just return the prompt as is

        return prompt;
      },
      { serverId },
    );
  }

  /**
   * Get all tools from all servers (internal implementation for legacy mode).
   * Queries all servers in parallel with a per-server timeout.
   */
  private async getAllToolsInternal(
    token?: string,
    projectId?: string | null,
  ): Promise<ToolWithSource[]> {
    const PER_SERVER_TIMEOUT_MS = 10_000;
    const normalizedProjectId = this.normalizeProjectId(projectId);
    const toolMap = this.ensureToolMap(normalizedProjectId);
    toolMap.clear();
    const shouldPrefix = this.shouldPrefixToolNames();

    // Build list of eligible servers
    const eligible: {
      serverId: string;
      client: ReconnectingMCPClient;
      serverName: string;
      server: MCPServer | undefined;
    }[] = [];
    for (const [serverId, client] of this.clients.entries()) {
      const server = this.servers.get(serverId);
      const serverName = server?.name || serverId;
      const isRunning = this.serverStatusMap.get(serverName);

      if (!isRunning || !client) continue;
      if (!this.matchesProject(server, normalizedProjectId)) continue;
      if (token) {
        try {
          this.tokenValidator.validateTokenAndAccess(token, serverName);
        } catch {
          continue;
        }
      }
      eligible.push({ serverId, client, serverName, server });
    }

    // Query all servers in parallel with per-server timeout
    const results = await Promise.allSettled(
      eligible.map(async ({ client, serverName, server }) => {
        let timeoutId: NodeJS.Timeout;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () =>
              reject(new Error(`Timed out after ${PER_SERVER_TIMEOUT_MS}ms`)),
            PER_SERVER_TIMEOUT_MS,
          );
        });

        try {
          const tools = await Promise.race([
            client.getClient().listTools(),
            timeoutPromise,
          ]);

          if (!tools.tools || tools.tools.length === 0) {
            return [];
          }

          const permissions = (server?.toolPermissions ?? {}) as Record<
            string,
            boolean
          >;

          const serverTools: ToolWithSource[] = [];

          for (const tool of tools.tools) {
            if (permissions[tool.name] === false) continue;

            const prefixedName = shouldPrefix
              ? prefixToolName(serverName, tool.name)
              : tool.name;

            serverTools.push({
              ...tool,
              name: prefixedName,
              sourceServer: serverName,
            });
          }
          return serverTools;
        } finally {
          clearTimeout(timeoutId!);
        }
      }),
    );

    // Collect results from fulfilled promises and record tool definition tokens
    const allTools: ToolWithSource[] = [];
    const tracker = getTokenBudgetTracker();
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        const serverName = eligible[i].serverName;
        for (const tool of result.value) {
          toolMap.set(tool.name, serverName);
          allTools.push(tool);
        }
        // Record tool definition token estimates for this server
        tracker.recordToolDefinitions(serverName, result.value);
      } else {
        console.error(
          `[MCPServerManager] Failed to get tools from server ${eligible[i].serverName}:`,
          result.reason,
        );
      }
    }

    // Append SystemServer tools (router_*) so they appear alongside aggregated tools
    const systemTools = this.getSystemToolDefinitions();
    for (const tool of systemTools) {
      toolMap.set(tool.name, "__system__");
      allTools.push({
        ...tool,
        sourceServer: "mcp-router-system",
      });
    }

    return allTools;
  }

  /**
   * Get tool definitions from the SystemServer, if initialised.
   * Returns an empty array if the SystemServerService is not yet available.
   */
  private getSystemToolDefinitions(): Array<
    Pick<Tool, "name" | "inputSchema"> & { description: string }
  > {
    try {
      // The SystemServer tool definitions conform structurally to Tool at
      // runtime, but their `typeof` inference is wider.  Cast to align types.
      return SystemServerService.getInstance()
        .getSystemServer()
        .getToolDefinitions() as Array<
        Pick<Tool, "name" | "inputSchema"> & { description: string }
      >;
    } catch {
      // SystemServerService not initialised yet — return nothing
      return [];
    }
  }

  /**
   * Route a router_* tool call to the SystemServer.
   */
  private async handleSystemToolCall(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<CallToolResult> {
    try {
      const systemServer = SystemServerService.getInstance().getSystemServer();
      return await systemServer.callTool(toolName, args);
    } catch (error: unknown) {
      // Re-throw McpError as-is; wrap anything else
      if (error instanceof McpError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `System tool error: ${message}`,
      );
    }
  }

  /**
   * Get server name for a given tool within the project scope (legacy mode)
   */
  private async getServerNameForTool(
    toolName: string,
    token?: string,
    projectId?: string | null,
  ): Promise<string | undefined> {
    const normalizedProjectId = this.normalizeProjectId(projectId);
    const projectKey = this.getProjectKey(normalizedProjectId);
    let toolMap = this.toolNameToServerMap.get(projectKey);

    if (!toolMap || !toolMap.has(toolName)) {
      await this.getAllToolsInternal(token, normalizedProjectId);
      toolMap = this.toolNameToServerMap.get(projectKey);
    }

    return toolMap?.get(toolName);
  }

  /**
   * Check rate limit for the given key and throw an McpError if the
   * request should be rejected.
   */
  private enforceRateLimit(key: string): void {
    const result: RateLimitResult = getRateLimiter().tryConsume(key);
    if (!result.allowed) {
      const retryAfterSec = Math.ceil((result.retryAfterMs ?? 1000) / 1000);
      // -32000 is the JSON-RPC standard code for "Server error" which is
      // the closest fit for a rate limit response (some APIs use 429 semantics,
      // but MCP maps to JSON-RPC standard error codes)
      const RATE_LIMIT_ERROR_CODE = -32000 as ErrorCode;
      throw new McpError(
        RATE_LIMIT_ERROR_CODE,
        `Rate limit exceeded for ${key}. Retry after ${retryAfterSec}s.`,
      );
    }
  }

  /**
   * Handle legacy tool call (when tool catalog is disabled)
   */
  private async handleLegacyToolCall(
    request: CallToolRequest,
    toolName: string,
    projectId: string | null,
  ): Promise<CallToolResult> {
    const token = request.params._meta?.token as string | undefined;
    const mappedServerName = await this.getServerNameForTool(
      toolName,
      token,
      projectId,
    );
    if (!mappedServerName) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Could not determine server for tool: ${toolName}`,
      );
    }
    const serverName = mappedServerName;

    // Rate limit by server and tool
    this.enforceRateLimit(`server:${serverName}`);
    const originalToolName = stripServerPrefix(toolName);
    this.enforceRateLimit(`tool:${serverName}:${originalToolName}`);

    const clientId = this.tokenValidator.validateTokenAndAccess(
      token,
      serverName,
    );

    const serverId = this.getServerIdByName(serverName);
    if (!serverId) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Unknown server: ${serverName}`,
      );
    }

    const server = this.servers.get(serverId);
    if (!this.matchesProject(server, projectId)) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        "Tool not available for the selected project",
      );
    }

    if (
      server?.toolPermissions &&
      server.toolPermissions[originalToolName] === false
    ) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Tool "${originalToolName}" is disabled for this server`,
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

    return this.executeWithHooksAndLogging(
      "tools/call",
      request.params,
      clientId,
      serverName,
      "CallTool",
      async () => {
        const toolArgs =
          (request.params.arguments as Record<string, unknown>) || {};
        const reqTokens = estimateRequestTokens({
          name: originalToolName,
          arguments: toolArgs,
        });

        const result = await client.getClient().callTool(
          {
            name: originalToolName,
            arguments: toolArgs,
          },
          undefined,
          {
            timeout: 60 * 60 * 1000, // 60 minutes
            resetTimeoutOnProgress: true,
          },
        );

        // Record token usage for this tool call
        const resTokens = estimateResponseTokens(result as object);
        getTokenBudgetTracker().recordUsage(
          serverName,
          originalToolName,
          reqTokens,
          resTokens,
        );

        // Detect and register task handles in the response
        const taskResult = result as Record<string, unknown>;
        if (
          taskResult.task &&
          typeof taskResult.task === "object" &&
          (taskResult.task as Record<string, unknown>).taskId
        ) {
          const task = taskResult.task as Record<string, unknown>;
          const originalTaskId = task.taskId as string;
          const namespacedId = getTaskRegistry().registerTask(
            originalTaskId,
            serverName,
            serverId,
            (task.status as string) ?? "working",
          );
          // Rewrite taskId so the client uses the namespaced version
          task.taskId = namespacedId;
        }

        // Transform resource links to use router's namespace
        return transformResourceLinksInResult(result, serverName);
      },
      { serverId },
    );
  }

  public getServerIdByName(name: string): string | undefined {
    return this.serverNameToIdMap.get(name);
  }

  /**
   * Handle elicitation/create request (passthrough to client)
   * Routes elicitation requests from backend servers to the connected client
   */
  public async handleElicitationCreate(
    request: ElicitationCreateRequest,
    backendServerId: string,
  ): Promise<ElicitationCreateResponse> {
    const elicitationId = request.params?.elicitationId;
    const mode = request.params?.mode;
    const message = request.params?.message;

    if (!elicitationId || !mode) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        "elicitationId and mode are required",
      );
    }

    // For URL mode, validate the URL for security
    if (mode === "url") {
      const url = request.params?.url;
      if (!url) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          "URL is required for url mode",
        );
      }

      const validation = validateElicitationUrl(url);
      if (!validation.isValid) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Invalid elicitation URL: ${validation.error}`,
        );
      }
    }

    // Track the elicitation for notification routing
    const clientSessionId = request.params?._meta?.sessionId || "default";
    getElicitationManager().createElicitation(
      elicitationId,
      clientSessionId,
      backendServerId,
      mode,
    );

    // Forward to client (the aggregator server will handle this)
    // Return the request for the aggregator to forward
    return {
      method: "elicitation/create",
      params: {
        elicitationId,
        mode,
        message,
        ...(mode === "form" && { schema: request.params.schema }),
        ...(mode === "url" && { url: request.params.url }),
      },
    };
  }

  /**
   * Handle elicitation completion notification from client
   */
  public handleElicitationComplete(elicitationId: string): void {
    getElicitationManager().completeElicitation(elicitationId);
  }
}
