import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { MCPServer } from "@mcp_router/shared";
import {
  parseResourceUri,
  createResourceUri,
  createUriVariants,
} from "@/main/utils/uri-utils";
import { MCPServerManager } from "../mcp-server-manager/mcp-server-manager";
import { TokenValidator } from "./token-validator";
import { RequestHandlerBase } from "./request-handler-base";

/**
 * Handles all request processing for the aggregator server
 */
export class RequestHandlers extends RequestHandlerBase {
  private originalProtocols: Map<string, string> = new Map();
  private toolNameToServerMap: Map<string, string> = new Map();
  private serverStatusMap: Map<string, boolean>;
  private servers: Map<string, MCPServer>;
  private clients: Map<string, Client>;
  private serverNameToIdMap: Map<string, string>;

  constructor(serverManager: MCPServerManager) {
    const maps = serverManager.getMaps();
    const tokenValidator = new TokenValidator(maps.serverNameToIdMap);
    super(tokenValidator);

    // Get maps from server manager
    this.servers = maps.servers;
    this.clients = maps.clients;
    this.serverNameToIdMap = maps.serverNameToIdMap;
    this.serverStatusMap = maps.serverStatusMap;
  }

  /**
   * Initialize Agent Tools virtual server
   */
  public initAgentToolsServer(): void {
    const agentServerName = "Agent Tools";
    this.serverStatusMap.set(agentServerName, true);
  }

  /**
   * Handle a request to list all tools from all servers
   */
  public async handleListTools(token?: string): Promise<any> {
    const clientId = this.getClientId(token);

    return this.executeWithHooks("tools/list", {}, clientId, async () => {
      const allTools = await this.getAllToolsInternal();
      return { tools: allTools };
    });
  }

  /**
   * Handle a call to a specific tool
   */
  public async handleCallTool(request: any): Promise<any> {
    const toolName = request.params.name;

    // Get server name and original tool name
    const mappedServerName = this.getServerNameForTool(toolName);
    if (!mappedServerName) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Could not determine server for tool: ${toolName}`,
      );
    }
    const serverName = mappedServerName;
    const originalToolName = toolName;

    const token = request.params._meta?.token as string | undefined;

    // Check if this is an agent tool first
    if (serverName === "Agent Tools") {
      return this.handleAgentToolCall(toolName, request.params.arguments || {});
    }

    // Validate token and get client ID for regular servers
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
        // Call the tool on the server
        return await client.callTool({
          name: originalToolName,
          arguments: request.params.arguments || {},
        });
      },
      { serverId },
    );
  }

  /**
   * Get all tools from all servers (internal implementation)
   */
  private async getAllToolsInternal(): Promise<any[]> {
    const allTools: any[] = [];

    // Add tools from running servers
    for (const [serverId, client] of this.clients.entries()) {
      const serverName = this.servers.get(serverId)?.name || serverId;
      const isRunning = this.serverStatusMap.get(serverName);

      if (!isRunning || !client) {
        continue;
      }

      try {
        // First, try to get the list of tools
        const tools = await client.listTools();

        if (!tools.tools || tools.tools.length === 0) {
          continue;
        }

        for (const tool of tools.tools) {
          const toolWithSource = {
            ...tool,
            name: tool.name,
            sourceServer: serverName,
          };

          // Store the mapping
          this.toolNameToServerMap.set(tool.name, serverName);

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
   * Handle a request to list all resources from all servers
   */
  public async handleListResources(token?: string): Promise<any> {
    const clientId = this.getClientId(token);

    return this.executeWithHooks("resources/list", {}, clientId, async () => {
      const allResources = await this.getAllResourcesInternal(token);
      return { resources: allResources };
    });
  }

  /**
   * Get all resources from all servers (internal implementation)
   */
  private async getAllResourcesInternal(token?: string): Promise<any[]> {
    const allResources: any[] = [];

    for (const [serverId, client] of this.clients.entries()) {
      const serverName = this.servers.get(serverId)?.name || serverId;
      const isRunning = this.serverStatusMap.get(serverName);

      if (!isRunning || !client) {
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
  public async handleListResourceTemplates(token?: string): Promise<any> {
    const clientId = this.getClientId(token);

    return this.executeWithHooks(
      "resources/templates/list",
      {},
      clientId,
      async () => {
        const allTemplates: any[] = [];

        for (const [serverId, client] of this.clients.entries()) {
          const serverName = this.servers.get(serverId)?.name || serverId;
          const isRunning = this.serverStatusMap.get(serverName);

          if (!isRunning || !client) {
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
  public async readResourceByUri(uri: string, token?: string): Promise<any> {
    const clientId = this.getClientId(token);

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
  public async getAllPromptsInternal(token?: string): Promise<any[]> {
    const allPrompts: any[] = [];

    for (const [serverId, client] of this.clients.entries()) {
      const serverName = this.servers.get(serverId)?.name || serverId;
      const isRunning = this.serverStatusMap.get(serverName);

      if (!isRunning || !client) {
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
  ): Promise<any> {
    const clientId = this.getClientId(token);

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
   * Get server name for a given tool
   */
  public getServerNameForTool(toolName: string): string | undefined {
    return this.toolNameToServerMap.get(toolName) || "Agent Tools";
  }

  /**
   * Get server ID by name
   */
  public getServerIdByName(name: string): string | undefined {
    return this.serverNameToIdMap.get(name);
  }

  /**
   * Handle agent tool calls
   */
  public async handleAgentToolCall(toolName: string, args: any): Promise<any> {
    // This would be implemented based on your agent tools logic
    // For now, returning a placeholder
    return {
      content: [
        {
          type: "text",
          text: `Agent tool ${toolName} called with args: ${JSON.stringify(args)}`,
        },
      ],
    };
  }
}
