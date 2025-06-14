import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { getDeployedAgentService } from '../lib/services/agent';
import { status } from './auth';
import { backgroundWindow } from '../main';
import { getSessionRepository } from '../lib/database/session-repository';

/**
 * Agent tools definitions and handlers for DeployedAgent integration
 */

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: any;
}

/**
 * Format agent name to comply with MCP tool name requirements: ^[a-zA-Z0-9_-]{1,64}$
 */
export function formatAgentNameForTool(agentName: string): string {
  // Replace invalid characters with underscores and truncate to 64 characters
  let formattedName = agentName
    .replace(/[^a-zA-Z0-9_-]/g, '_')  // Replace invalid chars with underscore
    .replace(/_{2,}/g, '_')           // Replace multiple underscores with single
    .replace(/^_+|_+$/g, '')         // Remove leading/trailing underscores
    .substring(0, 64);               // Truncate to 64 characters
  
  // Ensure the name is not empty and starts with alphanumeric
  if (!formattedName || !/^[a-zA-Z0-9]/.test(formattedName)) {
    formattedName = `agent_${formattedName || 'unnamed'}`.substring(0, 64);
  }
  
  return formattedName;
}

/**
 * Generate agent tool definition for a specific deployed agent
 */
export function createAgentTool(agentName: string, agentDescription: string, agentPurpose: string): AgentTool {
  const toolName = formatAgentNameForTool(agentName);
  
  return {
    name: toolName,
    description: `${agentName}: ${agentDescription} (Purpose: ${agentPurpose}). Note: This agent processes requests asynchronously in the background. You will receive a status confirmation immediately, and the actual processing will continue in the background.`,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Query to send to the agent (will be processed asynchronously)',
        },
      },
      required: ['query'],
    },
  };
}

/**
 * Agent tool handlers for DeployedAgent integration
 */
export class AgentToolHandler {
  private static _deployedAgentService: ReturnType<typeof getDeployedAgentService> | null = null;
  private static _sessionRepository: ReturnType<typeof getSessionRepository> | null = null;

  private static get deployedAgentService() {
    if (!this._deployedAgentService) {
      this._deployedAgentService = getDeployedAgentService();
    }
    return this._deployedAgentService;
  }

  private static get sessionRepository() {
    if (!this._sessionRepository) {
      this._sessionRepository = getSessionRepository();
    }
    return this._sessionRepository;
  }
  
  public static async handleTool(toolName: string, args: any): Promise<any> {
    // Handle special query result tools
    if (toolName === 'get_agent_query_result') {
      return this.handleGetQueryResult(args);
    }
    
    if (toolName === 'list_agent_sessions') {
      return this.handleListSessions(args);
    }
    
    // Find agent by formatted tool name
    const agents = this.deployedAgentService.getDeployedAgents();
    const agent = agents.find(a => {
      if (!a.mcpServerEnabled) return false;
      const formattedName = formatAgentNameForTool(a.name);
      return formattedName === toolName;
    });
    
    if (agent) {
      return this.handleCallAgent({ agentId: agent.id, ...args });
    }
    
    throw new McpError(ErrorCode.MethodNotFound, `Unknown agent tool: ${toolName}`);
  }

  /**
   * Get all deployed agents that have MCP server enabled
   */
  public static getEnabledAgentTools(): AgentTool[] {
    try {
      const agents = this.deployedAgentService.getDeployedAgents();
      
      const agentTools = agents
        .filter(agent => agent.mcpServerEnabled)
        .map(agent => createAgentTool(agent.name, agent.description, agent.purpose));
      
      // Add query result tools
      const queryResultTools: AgentTool[] = [
        {
          name: 'get_agent_query_result',
          description: 'Retrieve the result of a specific agent query by session ID. Use this to get the response from a previously submitted agent query.',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'The session ID returned when the query was submitted',
              },
            },
            required: ['sessionId'],
          },
        },
        {
          name: 'list_agent_sessions',
          description: 'List agent sessions. Without filters, returns the most recent sessions sorted by last update time. Can be filtered by status.',
          inputSchema: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['pending', 'processing', 'completed', 'failed'],
                description: 'Filter sessions by status',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of sessions to return (default: 10, max: 100)',
                minimum: 1,
                maximum: 100,
                default: 10,
              },
            },
            required: [],
          },
        },
      ];
      
      return [...agentTools, ...queryResultTools];
    } catch (error: any) {
      console.error('Failed to get enabled agent tools:', error);
      return [];
    }
  }

  private static async handleCallAgent(args: any): Promise<any> {
    const { agentId, query } = args;

    if (!agentId || typeof agentId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'agentId is required and must be a string');
    }
    
    if (!query || typeof query !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'query is required and must be a string');
    }

    try {
      // Verify agent exists
      const agentData = this.deployedAgentService.getDeployedAgentById(agentId);
      if (!agentData) {
        throw new McpError(ErrorCode.InvalidParams, `Agent with ID ${agentId} not found`);
      }

      if (!backgroundWindow) {
        throw new McpError(ErrorCode.InternalError, 'Background window not available');
      }

      // Get authentication token from main process
      const authStatus = await status();
      const authToken = authStatus.token;

      // Create a new session for each MCP call
      // Use the agentId directly to ensure consistency with AgentChat
      const session = this.sessionRepository.createSession(
        agentId,
        [],
        'mcp', // source
        'pending' // status
      );

      // Send message to background window to start chat (fire and forget)
      backgroundWindow.webContents.send('background-chat:start', {
        sessionId: session.id,
        agentId,
        query,
        agent: agentData,
        authToken,
        messages: [],
        source: 'mcp' // Indicate this is from MCP
      });
      
      // Return immediately with status message
      return {
        content: [
          {
            type: 'text',
            text: `✅ Request received and queued for processing.\n\nAgent "${agentData.name}" is now processing your query in the background.\nSession ID: ${session.id}\n\nNote: The agent is working asynchronously. The response will be generated in the background and you won't receive it through this tool call. This tool is designed for fire-and-forget operations where the agent processes requests independently.`,
          },
        ],
      };
    } catch (error: any) {
      // If it's already an McpError, don't wrap it again
      if (error instanceof McpError || (error.code !== undefined && typeof error.code === 'number')) {
        throw error;
      }
      // Only wrap non-MCP errors
      throw new McpError(ErrorCode.InternalError, `Failed to call agent: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Handle getting query result by session ID
   */
  private static async handleGetQueryResult(args: any): Promise<any> {
    const { sessionId } = args;

    if (!sessionId || typeof sessionId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'sessionId is required and must be a string');
    }

    try {
      const session = this.sessionRepository.getSessionWithResults(sessionId);
      
      if (!session) {
        throw new McpError(ErrorCode.InvalidParams, `Session with ID ${sessionId} not found`);
      }

      // Extract the last assistant message content if completed
      let resultContent = '';
      if (session.status === 'completed' && session.messages.length > 0) {
        const assistantMessages = session.messages.filter((msg: any) => msg.role === 'assistant');
        if (assistantMessages.length > 0) {
          const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
          resultContent = lastAssistantMessage.content || 'No content in response';
        } else {
          resultContent = 'No assistant response found';
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: `Status: ${session.status}

${session.status === 'completed' 
  ? `Result:\n${resultContent}`
  : session.status === 'failed' 
    ? 'Query failed'
    : session.status === 'processing'
      ? 'Still processing'
      : 'Pending'
}`,
          },
        ],
      };
    } catch (error: any) {
      if (error instanceof McpError || (error.code !== undefined && typeof error.code === 'number')) {
        throw error;
      }
      throw new McpError(ErrorCode.InternalError, `Failed to get query result: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Handle listing agent sessions
   */
  private static async handleListSessions(args: any): Promise<any> {
    const { status, limit = 10 } = args;

    try {
      let sessions;
      
      if (status) {
        // Validate status
        const validStatuses = ['pending', 'processing', 'completed', 'failed'];
        if (!validStatuses.includes(status)) {
          throw new McpError(ErrorCode.InvalidParams, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
        }
        
        sessions = this.sessionRepository.getSessionsByStatus(
          status as any,
          undefined, // No agent filtering
          { limit: Math.min(limit, 100) }
        );
      } else {
        // Get all recent sessions regardless of status
        sessions = this.sessionRepository.getRecentSessions({
          limit: Math.min(limit, 100),
          // Don't filter by source to show all sessions
          orderBy: 'updated_at',
          order: 'DESC'
        });
      }

      const sessionList = sessions.sessions
        .map(session => ({
          sessionId: session.id,
          status: session.status,
          createdAt: new Date(session.createdAt).toISOString(),
          updatedAt: new Date(session.updatedAt).toISOString(),
        }));

      return {
        content: [
          {
            type: 'text',
            text: `Found ${sessionList.length} sessions:

${sessionList.length > 0 
  ? sessionList.map(session => 
      `• Session ID: ${session.sessionId}
  Status: ${session.status}
  Created: ${session.createdAt}
  Updated: ${session.updatedAt}`
    ).join('\n\n')
  : 'No sessions found matching the criteria.'
}

${sessions.hasMore ? `\nMore sessions available.` : ''}`,
          },
        ],
      };
    } catch (error: any) {
      if (error instanceof McpError || (error.code !== undefined && typeof error.code === 'number')) {
        throw error;
      }
      throw new McpError(ErrorCode.InternalError, `Failed to list sessions: ${error.message || 'Unknown error'}`);
    }
  }
}