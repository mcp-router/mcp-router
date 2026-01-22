import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { MCPServer, UNASSIGNED_PROJECT_ID } from "@mcp_router/shared";
import {
  parseResourceUri,
  createResourceUri,
  createUriVariants,
} from "@/main/utils/uri-utils";
import { MCPServerManager } from "../mcp-server-manager/mcp-server-manager";
import { ToolCatalogService } from "@/main/modules/tool-catalog/tool-catalog.service";
import { TokenValidator } from "./token-validator";
import { RequestHandlerBase } from "./request-handler-base";
import { getProjectService } from "@/main/modules/projects/projects.service";
import {
  ToolCatalogHandler,
  META_TOOLS,
} from "@/main/modules/tool-catalog/tool-catalog-handler";

/**
 * Handles all request processing for the aggregator server
 */
export class RequestHandlers extends RequestHandlerBase {
  private originalProtocols: Map<string, string> = new Map();
  private toolNameToServerMap: Map<string, Map<string, string>> = new Map();
  private serverStatusMap: Map<string, boolean>;
  private servers: Map<string, MCPServer>;
  private clients: Map<string, Client>;
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
   * Check if tool catalog is enabled for the given project
   */
  private isToolCatalogEnabled(projectId: string | null): boolean {
    const optimization = this.getProjectOptimization(projectId);
    return !!optimization;
  }

  /**
   * Handle a request to list all tools from all servers
   */
  public async handleListTools(
    token?: string,
    projectIdInput?: unknown,
  ): Promise<any> {
    const clientId = this.getClientId(token);
    const projectId = this.normalizeProjectId(projectIdInput);

    return this.executeWithHooks("tools/list", {}, clientId, async () => {
      // If tool catalog is enabled, return META_TOOLS (tool_discovery, tool_execute)
      if (this.isToolCatalogEnabled(projectId)) {
        return { tools: META_TOOLS };
      }
      // Otherwise, return all tools from all servers (legacy behavior)
      const allTools = await this.getAllToolsInternal(token, projectId);
      return { tools: allTools };
    });
  }

  /**
   * Handle a call to a specific tool
   */
  public async handleCallTool(request: any): Promise<any> {
    const toolName = request.params.name;
    const projectId = this.normalizeProjectId(request.params._meta?.projectId);

    // Always handle META_TOOLS (tool_discovery, tool_execute) regardless of catalog mode
    if (toolName === "tool_discovery") {
      return await this.toolCatalogHandler.handleToolDiscovery(request);
    }

    if (toolName === "tool_execute") {
      return await this.toolCatalogHandler.handleToolExecute(request);
    }

    // If tool catalog is enabled, only META_TOOLS are available
    if (this.isToolCatalogEnabled(projectId)) {
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
  ): Promise<any> {
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
  ): Promise<any[]> {
    const normalizedProjectId = this.normalizeProjectId(projectId);
    const allResources: any[] = [];

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

      try {
        const resources = await client.listResources();

        if (!resources.resources || resources.resources.length === 0) {
          continue;
        }

        // Add resources with source server information
        for (const resource of resources.resources) {
          // Store the original protocol if not already stored
          if (
            resource.uri &&
            !this.originalProtocols.has(resource.uri) &&
            resource.uri.includes("://")
          ) {
            const protocol = resource.uri.split("://")[0];
            this.originalProtocols.set(resource.uri, protocol);
          }

          const resourceWithSource = {
            ...resource,
            sourceServer: serverName,
            uri: createResourceUri(serverName, resource.uri),
          };

          allResources.push(resourceWithSource);
        }
      } catch (error: any) {
        console.error(
          `[MCPServerManager] Failed to get resources from server ${serverName}:`,
          error,
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
  ): Promise<any> {
    const clientId = this.getClientId(token);
    const projectId = this.normalizeProjectId(projectIdInput);

    return this.executeWithHooks(
      "resources/templates/list",
      {},
      clientId,
      async () => {
        const allTemplates: any[] = [];

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

          try {
            const templates = await client.listResourceTemplates();

            if (
              !templates.resourceTemplates ||
              templates.resourceTemplates.length === 0
            ) {
              continue;
            }

            // Add templates with source server information
            for (const template of templates.resourceTemplates) {
              const templateWithSource = {
                ...template,
                sourceServer: serverName,
                uriTemplate: createResourceUri(
                  serverName,
                  template.uriTemplate,
                ),
              };

              allTemplates.push(templateWithSource);
            }
          } catch (error: any) {
            // Server might not support resource templates
            console.error(
              `[MCPServerManager] Failed to get resource templates from server ${serverName}:`,
              error,
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
  ): Promise<any> {
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

        let lastError: any;
        for (const variantUri of uriVariants) {
          try {
            const result = await client.readResource({ uri: variantUri.uri });

            // No display rules to apply for resources
            // Just return the result as is

            return result;
          } catch (error: any) {
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
  ): Promise<any[]> {
    const projectId = this.normalizeProjectId(projectIdInput);
    const allPrompts: any[] = [];

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

      try {
        const prompts = await client.listPrompts();

        if (!prompts.prompts || prompts.prompts.length === 0) {
          continue;
        }

        // Add prompts with source server information
        for (const prompt of prompts.prompts) {
          const promptWithSource = {
            ...prompt,
            sourceServer: serverName,
            // Prefix prompt name with server name to avoid collisions
            name: `${serverName}/${prompt.name}`,
          };

          allPrompts.push(promptWithSource);
        }
      } catch (error: any) {
        console.error(
          `[MCPServerManager] Failed to get prompts from server ${serverName}:`,
          error,
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
    promptArgs?: any,
    token?: string,
    projectIdInput?: unknown,
  ): Promise<any> {
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
        const prompt = await client.getPrompt({
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
   * Get all tools from all servers (internal implementation for legacy mode)
   */
  private async getAllToolsInternal(
    token?: string,
    projectId?: string | null,
  ): Promise<any[]> {
    const normalizedProjectId = this.normalizeProjectId(projectId);
    const toolMap = this.ensureToolMap(normalizedProjectId);
    toolMap.clear();
    const allTools: any[] = [];

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

      if (token) {
        try {
          this.tokenValidator.validateTokenAndAccess(token, serverName);
        } catch {
          continue;
        }
      }

      try {
        const tools = await client.listTools();

        if (!tools.tools || tools.tools.length === 0) {
          continue;
        }

        const permissions = (server?.toolPermissions ?? {}) as Record<
          string,
          boolean
        >;

        for (const tool of tools.tools) {
          if (permissions[tool.name] === false) {
            continue;
          }

          const toolWithSource = {
            ...tool,
            name: tool.name,
            sourceServer: serverName,
          };

          toolMap.set(tool.name, serverName);
          allTools.push(toolWithSource);
        }
      } catch (error: any) {
        console.error(
          `[MCPServerManager] Failed to get tools from server ${serverName}:`,
          error,
        );
      }
    }

    return allTools;
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
   * Handle legacy tool call (when tool catalog is disabled)
   */
  private async handleLegacyToolCall(
    request: any,
    toolName: string,
    projectId: string | null,
  ): Promise<any> {
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
    const originalToolName = toolName;

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
        return await client.callTool(
          {
            name: originalToolName,
            arguments: request.params.arguments || {},
          },
          undefined,
          {
            timeout: 60 * 60 * 1000, // 60分
            resetTimeoutOnProgress: true,
          },
        );
      },
      { serverId },
    );
  }

  public getServerIdByName(name: string): string | undefined {
    return this.serverNameToIdMap.get(name);
  }
}
