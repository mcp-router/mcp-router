import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { MCPServer, MCPServerConfig, MCPTool } from '../types';
import { getServerService, ServerService } from '../lib/services/server-service';
import { applyDisplayRules, applyRulesToInputSchema } from '../lib/utils/rule-utils';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse";
import { logService } from '../lib/services/log-service';
import { getTokenService } from '../lib/services/token-service';
import { connectToMCPServer, substituteArgsParameters } from '../lib/utils/mcp-client-util';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { parseResourceUri, createResourceUri, createUriVariants } from '../lib/utils/uri-utils';
import { summarizeResponse } from '../lib/utils/response-utils';
import { AGENT_TOOLS, AgentToolHandler } from './sample-tools';

// Constants for the Aggregator Server identification in LogService
const AGGREGATOR_SERVER_ID = 'mcp-router-aggregator';
const AGGREGATOR_SERVER_NAME = 'MCP Router Aggregator';

// Interface for request log entries
interface RequestLogEntry {
  timestamp: string;
  requestType: string;
  params: any;
  result: 'success' | 'error';
  errorMessage?: string;
  response?: any;
  duration: number; // in milliseconds
  clientId: string;
}

/**
 * An integrated MCP server manager that combines server management and aggregation functionality
 */
export class MCPServerManager {
  // Server management properties
  private servers: Map<string, MCPServer> = new Map();
  private clients: Map<string, Client> = new Map(); // Map server ID to MCP client
  private serverNameToIdMap: Map<string, string> = new Map(); // Map server name to server ID
  private serversDir: string;
  private serverService: ServerService;
  private transport: StreamableHTTPServerTransport;
  private sseTransport: SSEServerTransport | null = null;
  
  // Aggregator properties
  private serverStatusMap: Map<string, boolean> = new Map(); // Track which servers are connected
  private originalProtocols: Map<string, string> = new Map(); // Map resource URI to its original protocol
  private toolNameToServerMap: Map<string, string> = new Map(); // Map original tool name to server name
  private tokenService = getTokenService();
  
  // Aggregator server
  private aggregatorServer: Server;

  constructor() {
    // Initialize server manager properties
    this.serversDir = path.join(app.getPath('userData'), 'mcp-servers');
    if (!fs.existsSync(this.serversDir)) {
      fs.mkdirSync(this.serversDir, { recursive: true });
    }
    
    // Initialize server service
    this.serverService = getServerService();

    // Initialize the aggregator server
    this.initAggregatorServer();

    // Load servers from database
    this.loadServersFromDatabase();
  }
  
  /**
   * Initialize the MCP aggregator server
   */
  private async initAggregatorServer(): Promise<void> {
    try {
      // Initialize the MCP server
      this.aggregatorServer = new Server(
        {
          name: "mcp-aggregator",
          version: "1.0.0",
        },
        {
          capabilities: {
            resources: {},
            tools: {},
            prompts: {}
          },
        }
      );
      
      // Set up request handlers
      this.setupRequestHandlers();
      
      // Error handling
      this.aggregatorServer.onerror = (error) => {
        console.error('[MCP Aggregator Error]', error);
        // Log server errors
        this.recordRequestLog({
          timestamp: new Date().toISOString(),
          requestType: 'ServerError',
          params: {},
          result: 'error',
          errorMessage: error.message || 'Unknown server error',
          duration: 0,
          clientId: 'mcp-router-system'
        });
      };
      
      // Start the aggregator server with streamable transport
      await this.startAggregator();
      
    } catch (error) {
      console.error('Failed to initialize MCP Aggregator Server:', error);
    }
  }


  public getTransport(): StreamableHTTPServerTransport {
    return this.transport;
  }

  public getSSETransport(): SSEServerTransport | null {
    return this.sseTransport;
  }

  /**
   * Get the aggregator server instance
   * @returns The MCP aggregator server
   */
  public getAggregatorServer(): Server {
    return this.aggregatorServer;
  }

  /**
   * Start the aggregator server using stdio transport
   * This is used when running as a CLI tool via mcpr
   */
  public async startAggregator(): Promise<void> {
    try {
      // StreamableHTTP transport
      this.transport = new StreamableHTTPServerTransport({
        // ステートレスなサーバの場合、undefined を指定する
        sessionIdGenerator: undefined,
      });
      
      // SSE transportは実際にはHTTPエンドポイントで初期化します
      // ここではプロパティの初期化のみ行い、実際の初期化はHTTPサーバーのハンドラで行います
      this.sseTransport = null;
      
      // Connect server with primary transport
      await this.aggregatorServer.connect(this.transport);
    } catch (error) {
      console.error('Failed to initialize transports:', error);
      throw error;
    }
  }
  
  /**
   * Set up request handlers for the aggregator server
   */
  private setupRequestHandlers(): void {
    // List Tools - direct call without logging
    this.aggregatorServer.setRequestHandler(ListToolsRequestSchema, async (request) => {
      const token = request.params._meta?.token as string | undefined;
      return await this.handleListTools(token);
    });
    
    // Call Tool
    this.aggregatorServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      return await this.handleCallTool(request);
    });
    
    // List Resources - direct call without logging
    this.aggregatorServer.setRequestHandler(ListResourcesRequestSchema, async (request) => {
      const token = request.params._meta?.token as string | undefined;
      return await this.handleListResources(token);
    });
    
    // List Resource Templates - direct call without logging
    this.aggregatorServer.setRequestHandler(ListResourceTemplatesRequestSchema, async (request) => {
      const token = request.params._meta?.token as string | undefined;
      return await this.handleListResourceTemplates(token);
    });
    
    // Read Resource
    this.aggregatorServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;
      const token = request.params._meta?.token as string | undefined;
      return await this.readResourceByUri(uri, undefined, token);
    });
    
    // List Prompts
    this.aggregatorServer.setRequestHandler(ListPromptsRequestSchema, async (request) => {
      const token = request.params._meta?.token as string | undefined;
      const allPrompts = await this.getAllPromptsInternal(token);
      return { prompts: allPrompts };
    });
    
    // Get Prompt
    this.aggregatorServer.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const promptName = request.params.name;
      const token = request.params._meta?.token as string | undefined;
      return await this.getPromptByName(promptName, request.params.arguments, undefined, token);
    });
  }

  /**
   * データベースからサーバ一覧を読み込む
   */
  private loadServersFromDatabase(): void {
    try {
      const servers = this.serverService.getAllServers();
      
      servers.forEach(server => {
        // Initialize all servers as stopped when loading
        server.status = 'stopped';
        server.logs = [];
        this.servers.set(server.id, server);
        
        // サーバ名→IDのマッピングを更新
        this.updateServerNameMapping(server);
        
        // Auto start servers if configured
        if (server.autoStart && !server.disabled) {
          this.startServer(server.id).catch(console.error);
        }
      });
      
      //console.log(`${servers.length}個のサーバ設定を読み込みました`);
    } catch (error) {
      console.error('サーバ設定の読み込み中にエラーが発生しました:', error);
    }
  }
  
  /**
   * サーバ名→IDのマッピングを更新する
   * @param server サーバ情報
   */
  private updateServerNameMapping(server: MCPServer): void {
    // マッピングを更新（重複チェックなし）
    this.serverNameToIdMap.set(server.name, server.id);
  }
  
  /**
   * サーバ名からIDを取得する
   * @param name サーバ名
   * @returns サーバID（存在しない場合はundefined）
   */
  public getServerIdByName(name: string): string | undefined {
    return this.serverNameToIdMap.get(name);
  }
  
  /**
   * Get a list of all MCP servers
   * Always refreshes from database to ensure the list is up-to-date
   */
  public getServers(): MCPServer[] {
    // データベースから最新のサーバ情報を取得
    const dbServers = this.serverService.getAllServers();
    
    // データベースにあるがメモリにないサーバを追加
    dbServers.forEach(server => {
      if (!this.servers.has(server.id)) {
        // メモリ内のマップに追加
        this.servers.set(server.id, {
          ...server,
          status: 'stopped',  // 新しく追加されたサーバはデフォルトで停止状態
          logs: []            // ログは空の配列で初期化
        });
        // サーバ名→IDのマッピングを更新
        this.updateServerNameMapping(server);
      }
    });
    
    return Array.from(this.servers.values());
  }

  /**
   * Add a new MCP server
   * @param config サーバ設定（IDを含む）
   */
  public addServer(config: MCPServerConfig): MCPServer {
    // データベースにサーバを追加
    const newServer = this.serverService.addServer(config);
    
    // メモリ上のマップにも追加
    this.servers.set(newServer.id, newServer);
    
    // サーバ名→IDのマッピングを更新
    this.updateServerNameMapping(newServer);
    
    return newServer;
  }

  /**
   * Remove an MCP server
   */
  public removeServer(id: string): boolean {
    const server = this.servers.get(id);
    
    // Stop the server if it's running
    if (this.clients.has(id)) {
      this.stopServer(id);
    }
    
    // サーバIDを持つすべてのトークンからそのIDを削除
    try {
      const allTokens = this.tokenService.listTokens();
      for (const token of allTokens) {
        if (token.serverIds.includes(id)) {
          // サーバIDを削除したトークンで更新
          const updatedServerIds = token.serverIds.filter(serverId => serverId !== id);
          this.tokenService.updateTokenServerAccess(token.id, updatedServerIds);
        }
      }
    } catch (error) {
      console.error(`Failed to update tokens for server removal ${id}:`, error);
      // エラーがあっても処理を続行する
    }
    
    // データベースからサーバを削除
    const removed = this.serverService.deleteServer(id);
    
    // 成功した場合はメモリ上のマップからも削除
    if (removed && server) {
      // マッピングからサーバ名を削除
      this.serverNameToIdMap.delete(server.name);
      // サーバリストからも削除
      this.servers.delete(id);
    }
    
    return removed;
  }

  /**
   * Start an MCP server
   */
  public async startServer(id: string, clientId?: string): Promise<boolean> {    
    const server = this.servers.get(id);
    if (!server || server.disabled) {
      return false;
    }

    // If the server is already running, do nothing
    if (this.clients.has(id)) {
      return true;
    }

    try {
      server.status = 'starting';
      const client = await this.connectToServer(id);
      if (client) {
        this.clients.set(id, client);
        server.status = 'running';
        
        // Register the client (previously done in MCPAggregatorServer)
        this.serverStatusMap.set(server.name, true);
        
        // Record log of client registration with client identification
        this.recordRequestLog({
          timestamp: new Date().toISOString(),
          requestType: 'StartServer',
          params: { 
            serverName: server.name
           },
          result: 'success',
          duration: 0,
          clientId: clientId || 'unknownClient'
        });
        
        return true;
      }
      
      // Handle the case where connection failed but didn't throw an exception
      server.status = 'error';
      return false;
    } catch (error) {
      console.error(`Failed to start MCP server ${server.name}:`, error);
      server.status = 'error';
      return false;
    }
  }

  /**
   * Stop an MCP server
   */
  public stopServer(id: string, clientId?: string): boolean {
    const server = this.servers.get(id);
    if (!server) {
      return false;
    }

    const client = this.clients.get(id);
    if (!client) {
      server.status = 'stopped';
      return true;
    }

    try {
      server.status = 'stopping';
      
      // Unregister the client (previously done in MCPAggregatorServer)
      this.serverStatusMap.set(server.name, false);
      
      // Record log of client unregistration with client identification
      this.recordRequestLog({
        timestamp: new Date().toISOString(),
        requestType: 'StopServer',
        params: { 
          serverName: server.name
        },
        result: 'success',
        duration: 0,
        clientId: clientId || 'unknownClient'
      });
      
      // Disconnect the client - Use the close method instead of disconnect
      client.close();
      this.clients.delete(id);
      server.status = 'stopped';
      return true;
    } catch (error) {
      server.status = 'error';
      return false;
    }
  }

  /**
   * Update an MCP server's configuration
   */
  public updateServer(id: string, config: Partial<MCPServerConfig>): MCPServer | undefined {
    // 名前が変更される場合は古いマッピングを削除
    const oldServer = this.servers.get(id);
    if (oldServer && config.name && oldServer.name !== config.name) {
      this.serverNameToIdMap.delete(oldServer.name);
    }
    
    // Extract inputParamValues if provided and merge them into env
    // const configWithParams = config as Partial<MCPServerConfig> & { inputParamValues?: Record<string, string> };
    // if (configWithParams.inputParamValues) {
    //   // Create or update the env object with input param values
    //   config.env = { ...(config.env || {}), ...configWithParams.inputParamValues };
    //   // Remove inputParamValues from config as it's not part of MCPServerConfig
    //   delete configWithParams.inputParamValues;
    // }
    
    // データベースでサーバ情報を更新
    const updatedServer = this.serverService.updateServer(id, config);
    
    if (!updatedServer) {
      return undefined;
    }
    
    // メモリ上のサーバ情報を取得
    const server = this.servers.get(id);
    if (server) {
      // 実行時の状態を保持しつつ、設定情報を更新
      const status = server.status;
      const logs = server.logs || [];
      
      // 更新されたサーバ情報をメモリに反映
      Object.assign(server, updatedServer, { status, logs });
      
      // サーバ名→IDのマッピングを更新
      this.updateServerNameMapping(server);
    }
    
    return updatedServer;
  }

  /**
   * Get the status of a specific MCP server
   */
  public getServerStatus(id: string): 'running' | 'starting' | 'stopping' | 'stopped' | 'error' {
    const server = this.servers.get(id);
    if (!server) {
      return 'error';
    }
    return server.status;
  }


  /**
   * Connect to an MCP server
   */
  private async connectToServer(id: string): Promise<Client | null> {
    const server = this.servers.get(id);
    if (!server) {
      return null;
    }

    try {
      // Use the shared utility function for connecting to MCP servers
      const client = await connectToMCPServer(
        {
          id: server.id,
          name: server.name,
          serverType: server.serverType,
          command: server.command,
          args: server.args ? 
            substituteArgsParameters(server.args, server.env || {}, server.inputParams || {}) :
            undefined,
          remoteUrl: server.remoteUrl,
          bearerToken: server.bearerToken,
          env: server.env,
          inputParams: server.inputParams
        },
        "mcp-router"
      );
      
      // Update server status if connection failed
      if (!client) {
        server.status = 'error';
      }
      
      return client;
    } catch (error) {
      server.status = 'error';
      return null;
    }
  }

  /**
   * Record a log entry
   * @param logEntry The log entry to record
   * @param clientServerName Optional client server name to use instead of the aggregator name
   */
  private recordRequestLog(logEntry: RequestLogEntry, clientServerName?: string): void {
    // Determine server name and ID
    let serverName = AGGREGATOR_SERVER_NAME;
    let serverId = AGGREGATOR_SERVER_ID;
    
    if (clientServerName) {
      serverName = clientServerName;
      
      // サーバ名からIDへの変換を試みる
      const serverIdFromName = this.getServerIdByName(clientServerName);
      if (serverIdFromName) {
        serverId = serverIdFromName;
      } else {
        serverId = clientServerName; // IDが見つからない場合は名前をそのまま使用
      }
    }
    
    // Extract client information from the request parameters
    const clientId = logEntry.clientId;
    const clientName = clientId; // Default to clientId
    
    // Try to determine client from the parameters
    if (logEntry.params) {
      // Remove token from logged parameters for security
      if (logEntry.params.token) {
        delete logEntry.params.token;
      }
      if (logEntry.params._meta?.token) {
        delete logEntry.params._meta.token;
      }
    }
    

    // Save as request log for visualization
    logService.addRequestLog({
      clientId,
      clientName,
      serverId,
      serverName,
      requestType: logEntry.requestType,
      requestParams: logEntry.params,
      responseStatus: logEntry.result,
      responseData: logEntry.response,
      duration: logEntry.duration,
      errorMessage: logEntry.errorMessage
    });

  }


  /**
   * Handle a request to list all tools from all servers
   */
  private async handleListTools(token?: string): Promise<any> {
    const allTools = await this.getAllToolsInternal(token);
    return { tools: allTools };
  }

  /**
   * Handle a CallTool request from the aggregator server
   */
  private async handleCallTool(request: any): Promise<any> {
    const toolName = request.params.name;
    
    // Get server name and original tool name
    const mappedServerName = this.getServerNameForTool(toolName);
    if (!mappedServerName) {
      throw new McpError(ErrorCode.InvalidRequest, `Could not determine server for tool: ${toolName}`);
    }
    const serverName = mappedServerName;
    const originalToolName = toolName; // Use original tool name
    
    const token = request.params._meta?.token as string | undefined;
    
    // Check if this is an agent tool
    if (serverName === 'Agent Tools') {
      return this.handleAgentToolCall(toolName, request.params.arguments || {}, token);
    }
    
    // Validate token and get client ID
    const clientId = this.validateTokenAndAccess(token, serverName);
    
    const client = this.clients.get(this.getServerIdByName(serverName));
    if (!client) {
      throw new McpError(ErrorCode.InvalidRequest, `Unknown server: ${serverName}`);
    }
    
    if (!this.serverStatusMap.get(serverName)) {
      throw new McpError(ErrorCode.InvalidRequest, `Server ${serverName} is not running`);
    }
    
    
    // Add client ID and name to log entry
    const logEntry: RequestLogEntry = {
      timestamp: new Date().toISOString(),
      requestType: 'CallTool',
      params: { 
        toolName, 
        arguments: request.params.arguments
      },
      result: 'success',
      duration: 0,
      clientId
    };

    try {
      // Call the tool on the server
      const result = await client.callTool({
        name: originalToolName,
        arguments: request.params.arguments || {}
      });

      // Log success with client ID
      logEntry.response = summarizeResponse(result);
      logEntry.duration = Date.now() - new Date(logEntry.timestamp).getTime();
      this.recordRequestLog(logEntry, serverName);

      return result;
    } catch (error: any) {
      // Log error with client ID
      logEntry.result = 'error';
      logEntry.errorMessage = error.message;
      logEntry.duration = Date.now() - new Date(logEntry.timestamp).getTime();
      this.recordRequestLog(logEntry, serverName);
      throw error;
    }
  }


  /**
   * Get all tools from all running servers
   */
  private async getAllToolsInternal(token?: string): Promise<any[]> {
    const allTools: any[] = [];
    
    // Clear the existing tool-to-server mapping before repopulating
    this.toolNameToServerMap.clear();
    
    // Add sample tools for testing the aggregator
    this.addSampleTools(allTools);
    
    // Collect all tools without duplicate detection
    for (const [serverName, client] of this.clients.entries()) {
      try {
        const server = this.servers.get(serverName);
        if (!server || !this.serverStatusMap.get(server.name)) {
          continue;
        }
        
        if (token) {
          // Check token access using server's ID
          if (!this.tokenService.hasServerAccess(token, serverName)) {
            continue;
          }
        }
        
        const response = await client.listTools();
        
        if (response && Array.isArray(response.tools)) {
          // Add all tools with applied display rules
          response.tools.forEach(tool => {
            // Store mapping from tool name to server name
            this.toolNameToServerMap.set(tool.name, server.name);
            
            // Apply display rules to name and description
            const { name: customName, description: customDescription } = applyDisplayRules(
              tool.name,
              tool.description || '',
              server.name,
              'tool'
            );
            
            // Apply rules to tool input schema parameters if available
            let customInputSchema = tool.inputSchema;
            if (tool.inputSchema) {
              customInputSchema = applyRulesToInputSchema(
                tool.inputSchema,
                tool.name,
                server.name
              );
            }
            
            // Add tool with templated name, description, and inputSchema
            allTools.push({
              ...tool,
              name: customName,
              description: customDescription,
              inputSchema: customInputSchema
            });
          });
        }
      } catch (error) {
        console.error(`Failed to list tools from server ${serverName}:`, error);
      }
    }
    
    return allTools;
  }

  /**
   * Add agent tools to the tools list for agent integration
   */
  private addSampleTools(allTools: any[]): void {
    // Add agent tools with mapping to a virtual "Agent Tools" server
    const agentServerName = 'Agent Tools';
    AGENT_TOOLS.forEach(tool => {
      this.toolNameToServerMap.set(tool.name, agentServerName);
      allTools.push(tool);
    });
  }

  /**
   * Handle a request to list all resources from all servers
   */
  private async handleListResources(token?: string): Promise<any> {
    const allResources = await this.getAllResourcesInternal(token);
    return { resources: allResources };
  }

  /**
   * Get all resources from all running servers
   */
  private async getAllResourcesInternal(token?: string): Promise<any[]> {
    const allResources: any[] = [];
    
    for (const [serverName, client] of this.clients.entries()) {
      try {
        const server = this.servers.get(serverName);
        if (!server || !this.serverStatusMap.get(server.name)) {
          continue; // Skip servers that are not connected
        }
        
        // Skip servers the token doesn't have access to
        if (token) {
          if (!this.tokenService.hasServerAccess(token, serverName)) {
            continue;
          }
        }
        
        const response = await client.listResources();
        
        if (response && Array.isArray(response.resources)) {
          // Process each resource to store original protocol information
          response.resources.forEach(resource => {
            // Extract and store the original protocol
            const uri = resource.uri;
            const protocolMatch = uri.match(/^([a-zA-Z]+:\/\/)(.+)$/);
            
            let standardizedUri: string;
            
            // If we have a protocol, store it mapped to the standardized URI
            if (protocolMatch) {
              const originalProtocol = protocolMatch[1]; // e.g., "test://"
              const path = protocolMatch[2]; // The path without protocol
              standardizedUri = createResourceUri(server.name, path);
              
              // Store the mapping from standardized URI to original protocol
              this.originalProtocols.set(standardizedUri, originalProtocol);
            } else {
              // No protocol in the original URI
              standardizedUri = createResourceUri(server.name, uri);
            }
            
            // Apply display rules to name and description
            const { name: customName, description: customDescription } = applyDisplayRules(
              resource.name,
              resource.description || '',
              server.name,
              'resource'
            );
            
            // Add resource with templated name and description
            allResources.push({
              ...resource,
              uri: standardizedUri,
              name: customName,
              description: customDescription
            });
          });
        }
      } catch (error) {
        // console.error(`Failed to list resources from server ${serverName}:`, error);
      }
    }
    
    return allResources;
  }

  /**
   * Handle a request to list all resource templates from all servers
   */
  private async handleListResourceTemplates(token?: string): Promise<any> {
    const allTemplates: any[] = [];
    
    for (const [serverName, client] of this.clients.entries()) {
      try {
        const server = this.servers.get(serverName);
        if (!server || !this.serverStatusMap.get(server.name)) {
          continue; // Skip servers that are not connected
        }
                
        if (token) {
          if (!this.tokenService.hasServerAccess(token, serverName)) {
            continue;
          }
        }
        
        const response = await client.listResourceTemplates();
        
        if (response && Array.isArray(response.resourceTemplates)) {
          // Process each template similar to resources
          const templatesWithPrefix = response.resourceTemplates.map(template => {
            // Extract and store the original protocol
            const uriTemplate = template.uriTemplate;
            const protocolMatch = uriTemplate.match(/^([a-zA-Z]+:\/\/)(.+)$/);
            
            let standardizedTemplate: string;
            
            if (protocolMatch) {
              const originalProtocol = protocolMatch[1]; // e.g., "test://"
              const path = protocolMatch[2]; // The path without protocol
              standardizedTemplate = createResourceUri(server.name, path);
              
              // Store the protocol - use a special marker in the key to indicate it's a template
              this.originalProtocols.set(`template:${standardizedTemplate}`, originalProtocol);
            } else {
              // No protocol in the original URI template
              standardizedTemplate = createResourceUri(server.name, uriTemplate);
            }
            
            // Apply display rules to name and description
            const { name: customName, description: customDescription } = applyDisplayRules(
              template.name,
              template.description || '',
              server.name,
              'resourceTemplate'
            );
            
            return {
              ...template,
              uriTemplate: standardizedTemplate,
              name: customName,
              description: customDescription
            };
          });
          
          allTemplates.push(...templatesWithPrefix);
        }
      } catch (error) {
        console.error(`Failed to list resource templates from server ${serverName}:`, error);
      }
    }
    
    return { resourceTemplates: allTemplates };
  }

  /**
   * Read a resource by URI (resource://serverName/path)
   */
  public async readResourceByUri(uri: string, clientName?: string, token?: string): Promise<any> {
    const startTime = Date.now();
    const parsedUri = parseResourceUri(uri);
      
    if (!parsedUri) {
      throw new McpError(ErrorCode.InvalidRequest, `Invalid resource URI format. Expected "resource://serverName/path", got "${uri}"`);
    }
    
    const { serverName, path: originalPath } = parsedUri;

    // Validate token and get client ID
    const clientId = token ? this.validateTokenAndAccess(token, serverName) : 'unknownClient';
    
    // If clientName not provided explicitly, try to get it from token
    let derivedClientName = clientName;
    if (!derivedClientName && token) {
      const validationInfo = this.tokenService.validateToken(token);
      derivedClientName = validationInfo.clientId || clientId;
    }

    const logEntry: RequestLogEntry = {
      timestamp: new Date().toISOString(),
      requestType: 'ReadResource',
      params: { 
        uri
      },
      result: 'success',
      duration: 0,
      clientId
    };
    
    try {
      const serverId = this.getServerIdByName(serverName);
      if (!serverId) {
        throw new McpError(ErrorCode.InvalidRequest, `Unknown server: ${serverName}`);
      }

      const client = this.clients.get(serverId);
      if (!client) {
        throw new McpError(ErrorCode.InvalidRequest, `Server ${serverName} is not connected`);
      }
      
      if (!this.serverStatusMap.get(serverName)) {
        throw new McpError(ErrorCode.InvalidRequest, `Server ${serverName} is not running`);
      }
      
      // Get the standardized URI and look up the original protocol
      const standardizedUri = createResourceUri(serverName, originalPath);
      const originalProtocol = this.originalProtocols.get(standardizedUri);
      
      let response = null;
      
      // Try all possible URI formats in order of likelihood of success
      const uriFormats = createUriVariants(serverName, originalPath, originalProtocol);
      
      // Try each URI format until one succeeds
      for (const format of uriFormats) {
        try {
          response = await client.readResource({ uri: format.uri });
          
          if (response && Array.isArray(response.contents) && response.contents.length > 0) {
            break; // Success, exit the loop
          }
        } catch (error) {
          // Continue to the next format on error
        }
      }
      
      // If all attempts failed, return an empty response
      if (!response || !Array.isArray(response.contents) || response.contents.length === 0) {
        response = { contents: [] };
      }
      
      // Log success
      logEntry.response = summarizeResponse(response);
      logEntry.duration = Date.now() - startTime;
      this.recordRequestLog(logEntry, serverName);
      
      return response;
    } catch (error: any) {
      console.error(`Failed to read resource ${uri}:`, error);
      
      // Log error
      logEntry.result = 'error';
      logEntry.errorMessage = error.message;
      logEntry.duration = Date.now() - startTime;
      
      // Extract server name even in error case if possible
      try {
        const parsedUri = parseResourceUri(uri);
        if (parsedUri) {
          this.recordRequestLog(logEntry, parsedUri.serverName);
        } else {
          this.recordRequestLog(logEntry);
        }
      } catch (extractError) {
        this.recordRequestLog(logEntry);
      }
      
      throw error;
    }
  }

  /**
   * Get all prompts from all running servers
   */
  private async getAllPromptsInternal(token?: string): Promise<any[]> {
    const allPrompts: any[] = [];
    
    for (const [serverName, client] of this.clients.entries()) {
      try {
        const server = this.servers.get(serverName);
        if (!server || !this.serverStatusMap.get(server.name)) {
          continue; // Skip servers that are not connected
        }
        
        // Skip servers the token doesn't have access to
        if (token) {
          if (!this.tokenService.hasServerAccess(token, serverName)) {
            continue;
          }
        }
        
        const response = await client.listPrompts();
        
        if (response && Array.isArray(response.prompts)) {
          // Add all prompts with applied display rules
          response.prompts.forEach(prompt => {
            // Apply display rules to name and description
            const { name: customName, description: customDescription } = applyDisplayRules(
              prompt.name,
              prompt.description || '',
              server.name,
              'prompt'
            );
            
            // Add prompt with templated name and description
            allPrompts.push({
              ...prompt,
              name: customName,
              description: customDescription
            });
          });
        }
      } catch (error) {
        console.error(`Failed to list prompts from server ${serverName}:`, error);
      }
    }
    
    return allPrompts;
  }

  /**
   * Get a prompt by name
   */
  public async getPromptByName(promptName: string, args?: any, clientName?: string, token?: string): Promise<any> {
    const startTime = Date.now();
    
    // Get server name from the first available server that has this prompt name
    let serverName = '';
    const originalPromptName = promptName;
    
    // Search for a server with this prompt
    // In this implementation, without duplication handling, the first server with this prompt will be used
    for (const [servId, client] of this.clients.entries()) {
      const server = this.servers.get(servId);
      if (server && this.serverStatusMap.get(server.name)) {
        try {
          // Try to list prompts from this server
          const response = await client.listPrompts();
          if (response && Array.isArray(response.prompts)) {
            // If this server has the prompt, use it
            const hasPrompt = response.prompts.some(p => p.name === promptName);
            if (hasPrompt) {
              serverName = server.name;
              break;
            }
          }
        } catch (error) {
          // Ignore errors and continue to next server
        }
      }
    }
    
    // If still no server name, throw an error
    if (!serverName) {
      throw new McpError(ErrorCode.InvalidRequest, `Could not find any server with prompt name: ${promptName}`);
    }

    // Validate token and get client ID
    const clientId = token ? this.validateTokenAndAccess(token, serverName) : 'unknownClient';
    
    // If clientName not provided explicitly, try to get it from token
    let derivedClientName = clientName;
    if (!derivedClientName && token) {
      const validationInfo = this.tokenService.validateToken(token);
      derivedClientName = validationInfo.clientId || clientId;
    }

    const logEntry: RequestLogEntry = {
      timestamp: new Date().toISOString(),
      requestType: 'GetPrompt',
      params: { 
        promptName, 
        arguments: args
      },
      result: 'success',
      duration: 0,
      clientId
    };
    
    try {
      const serverId = this.getServerIdByName(serverName);
      if (!serverId) {
        throw new McpError(ErrorCode.InvalidRequest, `Unknown server: ${serverName}`);
      }

      const client = this.clients.get(serverId);
      if (!client) {
        throw new McpError(ErrorCode.InvalidRequest, `Server ${serverName} is not connected`);
      }
      
      if (!this.serverStatusMap.get(serverName)) {
        throw new McpError(ErrorCode.InvalidRequest, `Server ${serverName} is not running`);
      }
      
      const result = await client.getPrompt({
        name: originalPromptName,
        arguments: args || {}
      });
      
      // Log success
      logEntry.response = summarizeResponse(result);
      logEntry.duration = Date.now() - startTime;
      this.recordRequestLog(logEntry, serverName);
      
      return result;
    } catch (error: any) {
      console.error(`Failed to get prompt ${promptName} from server:`, error);
      
      // Log error
      logEntry.result = 'error';
      logEntry.errorMessage = error.message;
      logEntry.duration = Date.now() - startTime;
      
      // Record log
      this.recordRequestLog(logEntry, serverName);
      
      throw error;
    }
  }

  /**
   * Get server name for a tool by its name
   * @param toolName The tool name (either original or prefixed)
   * @returns The server name or undefined if not found
   */
  private getServerNameForTool(toolName: string): string | undefined {
    return this.toolNameToServerMap.get(toolName);
  }
  
  /**
   * Validate token and check server access in one step
   * @param token The token to validate
   * @param serverName The server name to check access for
   * @returns The client ID if token is valid and has access, throws error otherwise
   */
  private validateTokenAndAccess(token: string | undefined, serverName: string): string {
    // 通常の認証ロジック
    if (!token || typeof token !== 'string') {
      throw new McpError(ErrorCode.InvalidRequest, 'Token is required');
    }

    const validation = this.tokenService.validateToken(token);
    if (!validation.isValid) {
      throw new McpError(ErrorCode.InvalidRequest, validation.error || 'Invalid token');
    }

    // Get server ID from name
    const serverId = this.getServerIdByName(serverName);
    if (!serverId) {
      throw new McpError(ErrorCode.InvalidRequest, `Unknown server: ${serverName}`);
    }

    // Check server access
    if (!this.tokenService.hasServerAccess(token, serverId)) {
      throw new McpError(ErrorCode.InvalidRequest, 'Token does not have access to this server');
    }

    return validation.clientId!;
  }

  /**
   * Call a tool by name
   */
  public async callToolByName(toolName: string, args?: any, clientName?: string, token?: string): Promise<any> {
    const startTime = Date.now();
    
    // Get server name and original tool name
    let serverName: string;
    const originalToolName = toolName;
    
    // Look up the server name from our mapping
    const mappedServerName = this.getServerNameForTool(toolName);
    if (mappedServerName) {
      serverName = mappedServerName;
    } else {
      // If not found in mapping, search through all servers for this tool
      let found = false;
      for (const [servId, client] of this.clients.entries()) {
        const server = this.servers.get(servId);
        if (server && this.serverStatusMap.get(server.name)) {
          try {
            // Try to list tools from this server
            const response = await client.listTools();
            if (response && Array.isArray(response.tools)) {
              // If this server has the tool, use it
              const hasTool = response.tools.some(t => t.name === toolName);
              if (hasTool) {
                serverName = server.name;
                found = true;
                break;
              }
            }
          } catch (error) {
            // Ignore errors and continue to next server
          }
        }
      }
      
      // If no server found with this tool, throw error
      if (!found) {
        throw new McpError(ErrorCode.InvalidRequest, `Could not determine server for tool: ${toolName}`);
      }
    }

    // Validate token and get client ID
    const clientId = token ? this.validateTokenAndAccess(token, serverName) : 'unknownClient';
    
    // If clientName not provided explicitly, try to get it from token
    let derivedClientName = clientName;
    if (!derivedClientName && token) {
      const validationInfo = this.tokenService.validateToken(token);
      derivedClientName = validationInfo.clientId || clientId;
    }
    
    const logEntry: RequestLogEntry = {
      timestamp: new Date().toISOString(),
      requestType: 'CallTool',
      params: { 
        toolName, 
        arguments: args
      },
      result: 'success',
      duration: 0,
      clientId
    };

    try {
      // Find the server client
      const serverId = this.getServerIdByName(serverName);
      if (!serverId) {
        throw new McpError(ErrorCode.InvalidRequest, `Unknown server: ${serverName}`);
      }

      const client = this.clients.get(serverId);
      if (!client) {
        throw new McpError(ErrorCode.InvalidRequest, `Server ${serverName} is not connected`);
      }

      if (!this.serverStatusMap.get(serverName)) {
        throw new McpError(ErrorCode.InvalidRequest, `Server ${serverName} is not running`);
      }

      // Call the tool on the specified server
      const result = await client.callTool({
        name: originalToolName,
        arguments: args || {}
      });

      // Log success
      logEntry.response = summarizeResponse(result);
      logEntry.duration = Date.now() - startTime;
      this.recordRequestLog(logEntry, serverName);

      return result;
    } catch (error: any) {
      console.error(`Failed to call tool ${toolName}:`, error);

      // Log error
      logEntry.result = 'error';
      logEntry.errorMessage = error.message;
      logEntry.duration = Date.now() - startTime;
      // Record log with the server name if available
      this.recordRequestLog(logEntry, serverName);

      throw error;
    }
  }

  /**
   * Get tools for a specific server with their enabled status
   * @param id Server ID
   * @returns Array of MCPTools with their enabled status or null if server not found
   */
  public async getServerTools(id: string): Promise<MCPTool[] | null> {
    const server = this.servers.get(id);
    if (!server) {
      return null;
    }

    // If server is not running, try to start it to get tools
    let needToStopServer = false;
    
    
    if (!this.clients.has(id)) {
      const started = await this.startServer(id, 'MCP Router UI - Tool List');
      if (!started) {
        return [];
      }
      needToStopServer = true;
    }

    try {
      const client = this.clients.get(id);
      if (!client) {
        return [];
      }

      const response = await client.listTools();
      console.log(`Response from server ${id}:`, response);
      
      
      if (response && Array.isArray(response.tools)) {
        // Add enabled status based on stored permissions
        const toolPermissions = server.toolPermissions || {};
        return response.tools.map(tool => {
          if (!tool.name) {
            console.warn('Tool without name found in server response');
            return null;
          }
          return {
            name: tool.name, // Ensure name is always included as required by MCPTool
            description: tool.description,
            enabled: toolPermissions[tool.name] !== false // Default to enabled if not specified
          } as MCPTool;
        }).filter((tool): tool is MCPTool => tool !== null);
      }
      
      return [];
    } catch (error) {
      console.error(`Failed to list tools from server ${id}:`, error);
      return [];
    } finally {
      // Stop the server if we started it just for this operation
      if (needToStopServer) {
        this.stopServer(id, 'MCP Router UI - Tool List');
      }
    }
  }

  /**
   * Update tool permissions for a server
   * @param id Server ID
   * @param toolPermissions Object mapping tool names to their enabled status
   * @returns Updated server or null if server not found
   */
  public updateServerToolPermissions(id: string, toolPermissions: Record<string, boolean>): MCPServer | null {
    const server = this.servers.get(id);
    if (!server) {
      return null;
    }

    // Update server config with new tool permissions
    const updatedConfig: Partial<MCPServerConfig> = {
      toolPermissions
    };

    // Save to database
    const updatedServer = this.serverService.updateServer(id, updatedConfig);
    
    if (!updatedServer) {
      return null;
    }
    
    // Update in-memory server
    server.toolPermissions = toolPermissions;
    
    return server;
  }

  /**
   * Handle agent tool calls
   */
  private async handleAgentToolCall(toolName: string, args: any, token?: string): Promise<any> {
    // Log agent tool calls for monitoring
    const logEntry: RequestLogEntry = {
      timestamp: new Date().toISOString(),
      requestType: 'CallAgentTool',
      params: { 
        toolName, 
        arguments: args
      },
      result: 'success',
      duration: 0,
      clientId: token ? this.tokenService.validateToken(token).clientId || 'unknownClient' : 'unknownClient'
    };

    try {
      const result = await AgentToolHandler.handleTool(toolName, args);
      logEntry.response = summarizeResponse(result);
      logEntry.duration = Date.now() - new Date(logEntry.timestamp).getTime();
      this.recordRequestLog(logEntry, 'Agent Tools');
      return result;
    } catch (error: any) {
      logEntry.result = 'error';
      logEntry.errorMessage = error.message;
      logEntry.duration = Date.now() - new Date(logEntry.timestamp).getTime();
      this.recordRequestLog(logEntry, 'Agent Tools');
      throw error;
    }
  }

  /**
   * Clean up resources when the app is closing
   */
  public async shutdown(): Promise<void> {
    // Stop all running clients
    for (const [id] of this.clients) {
      this.stopServer(id);
    }
    
    // Close the aggregator server
    try {
      await this.aggregatorServer.close();
    } catch (err) {
      console.error('Error shutting down aggregator server:', err);
    }
  }
}
