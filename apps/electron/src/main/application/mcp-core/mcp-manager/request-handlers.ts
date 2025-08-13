import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { MCPServer, HookContext } from "@mcp_router/shared";
import {
  applyDisplayRules,
  applyRulesToInputSchema,
} from "@/main/domain/mcp-core/rule/rule-utils";
import {
  parseResourceUri,
  createResourceUri,
  createUriVariants,
} from "@/main/utils/uri-utils";
import { RequestLogEntry } from "./types";
import { LoggingService } from "./logging";
import { ServerManager } from "./server-manager";
import { TokenValidator } from "./token-validator";
import { getHookService } from "@/main/domain/mcp-core/hook/hook-service";

/**
 * Handles all request processing for the aggregator server
 */
export class RequestHandlers {
  private loggingService: LoggingService;
  private tokenValidator: TokenValidator;
  private originalProtocols: Map<string, string> = new Map();
  private toolNameToServerMap: Map<string, string> = new Map();
  private serverStatusMap: Map<string, boolean>;
  private servers: Map<string, MCPServer>;
  private clients: Map<string, Client>;
  private serverNameToIdMap: Map<string, string>;

  constructor(serverManager: ServerManager, loggingService: LoggingService) {
    this.loggingService = loggingService;

    // Get maps from server manager
    const maps = serverManager.getMaps();
    this.servers = maps.servers;
    this.clients = maps.clients;
    this.serverNameToIdMap = maps.serverNameToIdMap;
    this.serverStatusMap = maps.serverStatusMap;

    this.tokenValidator = new TokenValidator(this.serverNameToIdMap);
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
    const allTools = await this.getAllToolsInternal(token);
    return { tools: allTools };
  }

  /**
   * Handle a CallTool request
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

    // Create hook context
    const hookContext: HookContext = {
      requestType: "CallTool",
      serverName,
      serverId,
      clientId,
      token,
      toolName: originalToolName,
      request: {
        method: "tools/call",
        params: request.params,
      },
      metadata: {},
      startTime: Date.now(),
    };

    // Execute pre-hooks
    const hookService = getHookService();
    const preHookResult = await hookService.executePreHooks(hookContext);
    if (!preHookResult.continue) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        preHookResult.error?.message || "Request blocked by hook",
      );
    }

    // Update context from pre-hook result
    const updatedContext = preHookResult.context || hookContext;
    const updatedRequest = updatedContext.request.params;

    // Add client ID and name to log entry
    const logEntry: RequestLogEntry = {
      timestamp: new Date().toISOString(),
      requestType: "CallTool",
      params: {
        toolName,
        arguments: updatedRequest.arguments,
      },
      result: "success",
      duration: 0,
      clientId,
    };

    try {
      // Call the tool on the server with potentially modified params
      const result = await client.callTool({
        name: originalToolName,
        arguments: updatedRequest.arguments || {},
      });

      // Create post-hook context with response
      const postContext: HookContext = {
        ...updatedContext,
        response: result,
        duration: Date.now() - updatedContext.startTime,
      };

      // Execute post-hooks
      const postHookResult = await hookService.executePostHooks(postContext);
      if (!postHookResult.continue) {
        throw new McpError(
          ErrorCode.InternalError,
          postHookResult.error?.message || "Response blocked by hook",
        );
      }

      // Use the potentially modified response
      const finalResult = postHookResult.context?.response || result;

      // Log success
      logEntry.response = finalResult;
      logEntry.duration = Date.now() - new Date(logEntry.timestamp).getTime();
      this.loggingService.recordRequestLog(logEntry, serverName);

      return finalResult;
    } catch (error: any) {
      // Create error context for post-hooks
      const errorContext: HookContext = {
        ...updatedContext,
        error: error,
        duration: Date.now() - updatedContext.startTime,
      };

      // Execute post-hooks even on error
      await hookService.executePostHooks(errorContext);

      // Log error
      logEntry.result = "error";
      logEntry.errorMessage = error.message || String(error);
      logEntry.duration = Date.now() - new Date(logEntry.timestamp).getTime();
      this.loggingService.recordRequestLog(logEntry, serverName);

      // Just re-throw the original error without wrapping
      throw error;
    }
  }

  /**
   * Get all tools from all running servers
   */
  private async getAllToolsInternal(token?: string): Promise<any[]> {
    const allTools: any[] = [];

    // Clear the existing tool-to-server mapping
    this.toolNameToServerMap.clear();

    // Add agent tools
    // this.addAgentsAsTools(allTools); // Agent tools removed

    // Collect all tools
    for (const [serverId, client] of this.clients.entries()) {
      const server = this.servers.get(serverId);
      if (!server || !this.serverStatusMap.get(server.name)) {
        continue;
      }

      if (token) {
        // Check token access using server's ID
        if (!this.tokenValidator.hasServerAccess(token, serverId)) {
          continue;
        }
      }

      const response = await client.listTools();

      if (response && Array.isArray(response.tools)) {
        response.tools.forEach((tool) => {
          // Store mapping from tool name to server name
          this.toolNameToServerMap.set(tool.name, server.name);

          // Apply display rules to name and description
          const { name: customName, description: customDescription } =
            applyDisplayRules(
              tool.name,
              tool.description || "",
              server.name,
              "tool",
            );

          // Apply rules to tool input schema parameters
          let customInputSchema = tool.inputSchema;
          if (tool.inputSchema) {
            customInputSchema = applyRulesToInputSchema(
              tool.inputSchema,
              tool.name,
              server.name,
            );
          }

          // Add tool with templated name, description, and inputSchema
          allTools.push({
            ...tool,
            name: customName,
            description: customDescription,
            inputSchema: customInputSchema,
          });
        });
      }
    }

    return allTools;
  }

  /**
   * Add agent tools to the tools list
   */
  // private addAgentsAsTools(allTools: any[]): void {
  //   const agentServerName = "Agent Tools";
  //   const enabledAgentTools = AgentToolHandler.getEnabledAgentTools();

  //   enabledAgentTools.forEach((tool) => {
  //     this.toolNameToServerMap.set(tool.name, agentServerName);
  //     allTools.push(tool);
  //   });
  // }

  /**
   * Handle a request to list all resources from all servers
   */
  public async handleListResources(token?: string): Promise<any> {
    const allResources = await this.getAllResourcesInternal(token);
    return { resources: allResources };
  }

  /**
   * Get all resources from all running servers
   */
  private async getAllResourcesInternal(token?: string): Promise<any[]> {
    const allResources: any[] = [];

    for (const [serverId, client] of this.clients.entries()) {
      const server = this.servers.get(serverId);
      if (!server || !this.serverStatusMap.get(server.name)) {
        continue;
      }

      // Skip servers the token doesn't have access to
      if (token) {
        if (!this.tokenValidator.hasServerAccess(token, serverId)) {
          continue;
        }
      }

      const response = await client.listResources();

      if (response && Array.isArray(response.resources)) {
        response.resources.forEach((resource) => {
          // Extract and store the original protocol
          const uri = resource.uri;
          const protocolMatch = uri.match(/^([a-zA-Z]+:\/\/)(.+)$/);

          let standardizedUri: string;

          if (protocolMatch) {
            const originalProtocol = protocolMatch[1];
            const path = protocolMatch[2];
            standardizedUri = createResourceUri(server.name, path);

            // Store the mapping
            this.originalProtocols.set(standardizedUri, originalProtocol);
          } else {
            standardizedUri = createResourceUri(server.name, uri);
          }

          // Apply display rules
          const { name: customName, description: customDescription } =
            applyDisplayRules(
              resource.name,
              resource.description || "",
              server.name,
              "resource",
            );

          allResources.push({
            ...resource,
            uri: standardizedUri,
            name: customName,
            description: customDescription,
          });
        });
      }
    }

    return allResources;
  }

  /**
   * Handle a request to list all resource templates from all servers
   */
  public async handleListResourceTemplates(token?: string): Promise<any> {
    const allTemplates: any[] = [];

    for (const [serverName, client] of this.clients.entries()) {
      try {
        const server = this.servers.get(serverName);
        if (!server || !this.serverStatusMap.get(server.name)) {
          continue;
        }

        if (token) {
          if (!this.tokenValidator.hasServerAccess(token, serverName)) {
            continue;
          }
        }

        const response = await client.listResourceTemplates();

        if (response && Array.isArray(response.resourceTemplates)) {
          const templatesWithPrefix = response.resourceTemplates.map(
            (template) => {
              const uriTemplate = template.uriTemplate;
              const protocolMatch = uriTemplate.match(/^([a-zA-Z]+:\/\/)(.+)$/);

              let standardizedTemplate: string;

              if (protocolMatch) {
                const originalProtocol = protocolMatch[1];
                const path = protocolMatch[2];
                standardizedTemplate = createResourceUri(server.name, path);

                this.originalProtocols.set(
                  `template:${standardizedTemplate}`,
                  originalProtocol,
                );
              } else {
                standardizedTemplate = createResourceUri(
                  server.name,
                  uriTemplate,
                );
              }

              const { name: customName, description: customDescription } =
                applyDisplayRules(
                  template.name,
                  template.description || "",
                  server.name,
                  "resourceTemplate",
                );

              return {
                ...template,
                uriTemplate: standardizedTemplate,
                name: customName,
                description: customDescription,
              };
            },
          );

          allTemplates.push(...templatesWithPrefix);
        }
      } catch (error) {
        console.error(
          `Failed to list resource templates from server ${serverName}:`,
          error,
        );
      }
    }

    return { resourceTemplates: allTemplates };
  }

  /**
   * Read a resource by URI
   */
  public async readResourceByUri(
    uri: string,
    clientName?: string,
    token?: string,
  ): Promise<any> {
    const startTime = Date.now();
    const parsedUri = parseResourceUri(uri);

    if (!parsedUri) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Invalid resource URI format. Expected "resource://serverName/path", got "${uri}"`,
      );
    }

    const { serverName, path: originalPath } = parsedUri;

    // Validate token and get client ID
    const clientId = token
      ? this.tokenValidator.validateTokenAndAccess(token, serverName)
      : "unknownClient";

    // If clientName not provided, try to get it from token
    let derivedClientName = clientName;
    if (!derivedClientName && token) {
      const validationInfo = this.tokenValidator.validateToken(token);
      derivedClientName = validationInfo.clientId || clientId;
    }

    const logEntry: RequestLogEntry = {
      timestamp: new Date().toISOString(),
      requestType: "ReadResource",
      params: { uri },
      result: "success",
      duration: 0,
      clientId,
    };

    try {
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

      // Get the standardized URI and look up the original protocol
      const standardizedUri = createResourceUri(serverName, originalPath);
      const originalProtocol = this.originalProtocols.get(standardizedUri);

      let response = null;

      // Try all possible URI formats
      const uriFormats = createUriVariants(
        serverName,
        originalPath,
        originalProtocol,
      );

      // Try each URI format until one succeeds
      for (const format of uriFormats) {
        response = await client.readResource({ uri: format.uri });

        if (
          response &&
          Array.isArray(response.contents) &&
          response.contents.length > 0
        ) {
          break;
        }
      }

      // If all attempts failed, return an empty response
      if (
        !response ||
        !Array.isArray(response.contents) ||
        response.contents.length === 0
      ) {
        response = { contents: [] };
      }

      // Log success
      logEntry.response = response;
      logEntry.duration = Date.now() - startTime;
      this.loggingService.recordRequestLog(logEntry, serverName);

      return response;
    } catch (error: any) {
      // Log error
      logEntry.result = "error";
      logEntry.errorMessage = error.message || String(error);
      logEntry.duration = Date.now() - startTime;

      // Try to log with server name if possible
      const parsedUri = parseResourceUri(uri);
      this.loggingService.recordRequestLog(logEntry, parsedUri?.serverName);

      throw error;
    }
  }

  /**
   * Get all prompts from all running servers
   */
  public async getAllPromptsInternal(token?: string): Promise<any[]> {
    const allPrompts: any[] = [];

    for (const [serverName, client] of this.clients.entries()) {
      try {
        const server = this.servers.get(serverName);
        if (!server || !this.serverStatusMap.get(server.name)) {
          continue;
        }

        // Skip servers the token doesn't have access to
        if (token) {
          if (!this.tokenValidator.hasServerAccess(token, serverName)) {
            continue;
          }
        }

        const response = await client.listPrompts();

        if (response && Array.isArray(response.prompts)) {
          response.prompts.forEach((prompt) => {
            const { name: customName, description: customDescription } =
              applyDisplayRules(
                prompt.name,
                prompt.description || "",
                server.name,
                "prompt",
              );

            allPrompts.push({
              ...prompt,
              name: customName,
              description: customDescription,
            });
          });
        }
      } catch (error) {
        console.error(
          `Failed to list prompts from server ${serverName}:`,
          error,
        );
      }
    }

    return allPrompts;
  }

  /**
   * Get a prompt by name
   */
  public async getPromptByName(
    promptName: string,
    args?: any,
    clientName?: string,
    token?: string,
  ): Promise<any> {
    const startTime = Date.now();

    // Get server name
    let serverName = "";
    const originalPromptName = promptName;

    // Search for a server with this prompt
    for (const [servId, client] of this.clients.entries()) {
      const server = this.servers.get(servId);
      if (server && this.serverStatusMap.get(server.name)) {
        const response = await client.listPrompts();
        if (response && Array.isArray(response.prompts)) {
          const hasPrompt = response.prompts.some((p) => p.name === promptName);
          if (hasPrompt) {
            serverName = server.name;
            break;
          }
        }
      }
    }

    if (!serverName) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Could not find any server with prompt name: ${promptName}`,
      );
    }

    // Validate token and get client ID
    const clientId = token
      ? this.tokenValidator.validateTokenAndAccess(token, serverName)
      : "unknownClient";

    const logEntry: RequestLogEntry = {
      timestamp: new Date().toISOString(),
      requestType: "GetPrompt",
      params: {
        promptName,
        arguments: args,
      },
      result: "success",
      duration: 0,
      clientId,
    };

    try {
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

      const result = await client.getPrompt({
        name: originalPromptName,
        arguments: args || {},
      });

      // Log success
      logEntry.response = result;
      logEntry.duration = Date.now() - startTime;
      this.loggingService.recordRequestLog(logEntry, serverName);

      return result;
    } catch (error: any) {
      // Log error
      logEntry.result = "error";
      logEntry.errorMessage = error.message || String(error);
      logEntry.duration = Date.now() - startTime;
      this.loggingService.recordRequestLog(logEntry, serverName);

      throw error;
    }
  }

  /**
   * Get server name for a tool by its name
   */
  private getServerNameForTool(toolName: string): string | undefined {
    return this.toolNameToServerMap.get(toolName);
  }

  /**
   * Get server ID by name
   */
  private getServerIdByName(name: string): string | undefined {
    return this.serverNameToIdMap.get(name);
  }

  /**
   * Handle agent tool calls
   */
  private async handleAgentToolCall(
    toolName: string,
    _args: any,
  ): Promise<any> {
    // return await AgentToolHandler.handleTool(toolName, args);
    throw new McpError(
      ErrorCode.MethodNotFound,
      `Agent tool ${toolName} not available`,
    );
  }
}
