import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ServerClient } from "@mcp_router/shared";

/**
 * Pure MCP Aggregator that combines capabilities from multiple MCP servers
 */
export class MCPAggregator {
  private server: Server;
  private clients: Map<string, ServerClient> = new Map();
  private toolToServerMap: Map<string, string> = new Map();
  private resourceProtocolMap: Map<string, string> = new Map();

  constructor() {
    this.server = new Server(
      {
        name: "mcp-aggregator",
        version: "1.0.0",
      },
      {
        capabilities: {
          resources: {},
          tools: {},
          prompts: {},
        },
      },
    );

    this.setupRequestHandlers();
  }

  /**
   * Get the aggregator server instance
   */
  public getServer(): Server {
    return this.server;
  }

  /**
   * Register a client to aggregate
   */
  public registerClient(id: string, name: string, client: Client): void {
    this.clients.set(id, { id, name, client });
  }

  /**
   * Unregister a client
   */
  public unregisterClient(id: string): void {
    const serverClient = this.clients.get(id);
    if (serverClient) {
      // Clean up tool mappings for this server
      for (const [toolName, serverId] of this.toolToServerMap) {
        if (serverId === id) {
          this.toolToServerMap.delete(toolName);
        }
      }
      this.clients.delete(id);
    }
  }

  /**
   * Set up request handlers
   */
  private setupRequestHandlers(): void {
    // List Tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = await this.aggregateTools();
      return { tools };
    });

    // Call Tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      return await this.callTool(request.params);
    });

    // List Resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = await this.aggregateResources();
      return { resources };
    });

    // List Resource Templates
    this.server.setRequestHandler(
      ListResourceTemplatesRequestSchema,
      async () => {
        const resourceTemplates = await this.aggregateResourceTemplates();
        return { resourceTemplates };
      },
    );

    // Read Resource
    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        return await this.readResource(request.params.uri);
      },
    );

    // List Prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      const prompts = await this.aggregatePrompts();
      return { prompts };
    });

    // Get Prompt
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      return await this.getPrompt(
        request.params.name,
        request.params.arguments,
      );
    });
  }

  /**
   * Aggregate tools from all clients
   */
  private async aggregateTools(): Promise<any[]> {
    const allTools: any[] = [];
    this.toolToServerMap.clear();

    // Collect tools from all clients in parallel
    const toolPromises = Array.from(this.clients.values()).map(
      async (serverClient) => {
        try {
          const response = await serverClient.client.listTools();
          if (response && Array.isArray(response.tools)) {
            return { serverId: serverClient.id, tools: response.tools };
          }
        } catch (error) {
          console.error(
            `Failed to list tools from server ${serverClient.name}:`,
            error,
          );
        }
        return null;
      },
    );

    const results = await Promise.all(toolPromises);

    // Process results
    for (const result of results) {
      if (result) {
        for (const tool of result.tools) {
          // Map tool to server
          this.toolToServerMap.set(tool.name, result.serverId);
          allTools.push(tool);
        }
      }
    }

    return allTools;
  }

  /**
   * Call a tool on the appropriate server
   */
  private async callTool(params: any): Promise<any> {
    const { name, arguments: args } = params;
    const serverId = this.toolToServerMap.get(name);

    if (!serverId) {
      throw new McpError(ErrorCode.InvalidRequest, `Tool not found: ${name}`);
    }

    const serverClient = this.clients.get(serverId);
    if (!serverClient) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Server not available for tool: ${name}`,
      );
    }

    try {
      return await serverClient.client.callTool({
        name,
        arguments: args || {},
      });
    } catch (error) {
      console.error(`Failed to call tool ${name}:`, error);
      throw error;
    }
  }

  /**
   * Aggregate resources from all clients
   */
  private async aggregateResources(): Promise<any[]> {
    const allResources: any[] = [];

    // Collect resources from all clients in parallel
    const resourcePromises = Array.from(this.clients.values()).map(
      async (serverClient) => {
        try {
          const response = await serverClient.client.listResources();
          if (response && Array.isArray(response.resources)) {
            return {
              serverName: serverClient.name,
              resources: response.resources,
            };
          }
        } catch (error) {
          console.error(
            `Failed to list resources from server ${serverClient.name}:`,
            error,
          );
        }
        return null;
      },
    );

    const results = await Promise.all(resourcePromises);

    // Process results
    for (const result of results) {
      if (result) {
        for (const resource of result.resources) {
          // Store original protocol if present
          const protocolMatch = resource.uri.match(/^([a-zA-Z]+:\/\/)(.+)$/);
          let standardizedUri: string;

          if (protocolMatch) {
            const originalProtocol = protocolMatch[1];
            const path = protocolMatch[2];
            standardizedUri = `resource://${result.serverName}/${path}`;
            this.resourceProtocolMap.set(standardizedUri, originalProtocol);
          } else {
            standardizedUri = `resource://${result.serverName}/${resource.uri}`;
          }

          allResources.push({
            ...resource,
            uri: standardizedUri,
          });
        }
      }
    }

    return allResources;
  }

  /**
   * Aggregate resource templates from all clients
   */
  private async aggregateResourceTemplates(): Promise<any[]> {
    const allTemplates: any[] = [];

    const templatePromises = Array.from(this.clients.values()).map(
      async (serverClient) => {
        try {
          const response = await serverClient.client.listResourceTemplates();
          if (response && Array.isArray(response.resourceTemplates)) {
            return {
              serverName: serverClient.name,
              templates: response.resourceTemplates,
            };
          }
        } catch (error) {
          console.error(
            `Failed to list resource templates from server ${serverClient.name}:`,
            error,
          );
        }
        return null;
      },
    );

    const results = await Promise.all(templatePromises);

    for (const result of results) {
      if (result) {
        for (const template of result.templates) {
          const protocolMatch = template.uriTemplate.match(
            /^([a-zA-Z]+:\/\/)(.+)$/,
          );
          let standardizedTemplate: string;

          if (protocolMatch) {
            const originalProtocol = protocolMatch[1];
            const path = protocolMatch[2];
            standardizedTemplate = `resource://${result.serverName}/${path}`;
            this.resourceProtocolMap.set(
              `template:${standardizedTemplate}`,
              originalProtocol,
            );
          } else {
            standardizedTemplate = `resource://${result.serverName}/${template.uriTemplate}`;
          }

          allTemplates.push({
            ...template,
            uriTemplate: standardizedTemplate,
          });
        }
      }
    }

    return allTemplates;
  }

  /**
   * Read a resource from the appropriate server
   */
  private async readResource(uri: string): Promise<any> {
    // Parse resource URI (resource://serverName/path)
    const match = uri.match(/^resource:\/\/([^/]+)\/(.*)$/);
    if (!match) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Invalid resource URI format: ${uri}`,
      );
    }

    const [, serverName, path] = match;

    // Find the server client by name
    let targetClient: ServerClient | undefined;
    for (const client of this.clients.values()) {
      if (client.name === serverName) {
        targetClient = client;
        break;
      }
    }

    if (!targetClient) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Server not found: ${serverName}`,
      );
    }

    // Try to read with original protocol if stored
    const originalProtocol = this.resourceProtocolMap.get(uri);
    const uriVariants = [];

    if (originalProtocol) {
      uriVariants.push(`${originalProtocol}${path}`);
    }
    uriVariants.push(path);
    uriVariants.push(`${serverName}://${path}`);

    // Try each variant
    for (const variantUri of uriVariants) {
      try {
        const response = await targetClient.client.readResource({
          uri: variantUri,
        });
        if (response && response.contents && response.contents.length > 0) {
          return response;
        }
      } catch {
        // Continue to next variant
      }
    }

    return { contents: [] };
  }

  /**
   * Aggregate prompts from all clients
   */
  private async aggregatePrompts(): Promise<any[]> {
    const allPrompts: any[] = [];

    const promptPromises = Array.from(this.clients.values()).map(
      async (serverClient) => {
        try {
          const response = await serverClient.client.listPrompts();
          if (response && Array.isArray(response.prompts)) {
            return response.prompts;
          }
        } catch (error) {
          console.error(
            `Failed to list prompts from server ${serverClient.name}:`,
            error,
          );
        }
        return [];
      },
    );

    const results = await Promise.all(promptPromises);
    for (const prompts of results) {
      allPrompts.push(...prompts);
    }

    return allPrompts;
  }

  /**
   * Get a prompt by name from the first server that has it
   */
  private async getPrompt(name: string, args?: any): Promise<any> {
    // Try each server until we find one with this prompt
    for (const serverClient of this.clients.values()) {
      try {
        const promptsResponse = await serverClient.client.listPrompts();
        if (promptsResponse && Array.isArray(promptsResponse.prompts)) {
          const hasPrompt = promptsResponse.prompts.some(
            (p: any) => p.name === name,
          );
          if (hasPrompt) {
            return await serverClient.client.getPrompt({
              name,
              arguments: args || {},
            });
          }
        }
      } catch {
        // Continue to next server
      }
    }

    throw new McpError(ErrorCode.InvalidRequest, `Prompt not found: ${name}`);
  }

  /**
   * Get health status of all registered clients
   */
  public getHealthStatus(): Map<string, boolean> {
    const health = new Map<string, boolean>();
    for (const [id] of this.clients) {
      // Simple health check - client exists and is registered
      health.set(id, true);
    }
    return health;
  }
}
