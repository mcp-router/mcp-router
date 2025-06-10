import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { getDeployedAgentService } from '../lib/services/agent';
import { status } from './auth';
import { backgroundWindow } from '../main';
import { getSessionRepository } from '../lib/database/session-repository';
import { getServerAgentId } from '../lib/utils/agent-utils';

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
  private static deployedAgentService = getDeployedAgentService();
  private static sessionRepository = getSessionRepository();
  
  public static async handleTool(toolName: string, args: any): Promise<any> {
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
      
      return agents
        .filter(agent => agent.mcpServerEnabled)
        .map(agent => createAgentTool(agent.name, agent.description, agent.purpose));
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
      // Use getServerAgentId to ensure consistency with BackgroundComponent
      const serverAgentId = getServerAgentId(agentData);
      const session = this.sessionRepository.createSession(
        serverAgentId,
        [],
        `MCP Call from ${new Date().toISOString()}`
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


}