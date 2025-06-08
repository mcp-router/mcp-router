import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { getDeployedAgentService } from '../lib/services/agent';

/**
 * Agent tools definitions and handlers for DeployedAgent integration
 */

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: any;
}

export const AGENT_TOOLS: AgentTool[] = [
  {
    name: 'getAgents',
    description: 'Get list of all deployed agents',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'callAgent',
    description: 'Call a deployed agent with a query',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'ID of the deployed agent to call',
        },
        sessionId: {
          type: 'string',
          description: 'Session ID for the conversation',
        },
        query: {
          type: 'string',
          description: 'Query to send to the agent',
        },
      },
      required: ['agentId', 'sessionId', 'query'],
    },
  },
];

/**
 * Agent tool handlers for DeployedAgent integration
 */
export class AgentToolHandler {
  private static deployedAgentService = getDeployedAgentService();
  
  public static async handleTool(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case 'getAgents':
        return this.handleGetAgents(args);
      case 'callAgent':
        return this.handleCallAgent(args);
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown agent tool: ${toolName}`);
    }
  }

  private static handleGetAgents(_args: any): any {
    try {
      const agents = this.deployedAgentService.getDeployedAgents();
      
      const agentList = agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        purpose: agent.purpose,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
      }));

      return {
        content: [
          {
            type: 'text',
            text: `Available Deployed Agents (${agentList.length}):\n\n${agentList.map(agent => `ID: ${agent.id}\nName: ${agent.name}\nDescription: ${agent.description}\nPurpose: ${agent.purpose}\n`).join('\n')}`,
          },
        ],
      };
    } catch (error: any) {
      throw new McpError(ErrorCode.InternalError, `Failed to get agents: ${error.message}`);
    }
  }

  private static async handleCallAgent(args: any): Promise<any> {
    const { agentId, sessionId, query } = args;

    if (!agentId || typeof agentId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'agentId is required and must be a string');
    }
    
    if (!sessionId || typeof sessionId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'sessionId is required and must be a string');
    }
    
    if (!query || typeof query !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'query is required and must be a string');
    }

    try {
      const agent = this.deployedAgentService.getDeployedAgentById(agentId);
      if (!agent) {
        throw new McpError(ErrorCode.InvalidParams, `Agent with ID ${agentId} not found`);
      }

      // Note: This is a simplified implementation.
      // In a real scenario, you would need to implement proper chat handling
      // possibly through the background window or a dedicated chat service.
      const response = `Agent ${agent.name} received query: "${query}" in session ${sessionId}\n\nThis is a mock response. To implement full chat functionality, integrate with the actual chat system used in the AgentChat component.`;

      return {
        content: [
          {
            type: 'text',
            text: response,
          },
        ],
      };
    } catch (error: any) {
      throw new McpError(ErrorCode.InternalError, `Failed to call agent: ${error.message}`);
    }
  }
}