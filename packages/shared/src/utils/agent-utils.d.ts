import { AgentConfig, DeployedAgent } from "../types/mcp-types";
/**
 * Agent utility functions
 */
/**
 * Type guard to check if an agent is a DeployedAgent
 * @param agent The agent to check
 * @returns true if the agent is a DeployedAgent
 */
export declare function isDeployedAgent(agent: AgentConfig | DeployedAgent): agent is DeployedAgent;
/**
 * Get the server agent ID for API communication
 * Uses originalId if available (for deployed/shared agents), falls back to local ID
 * @param agent The agent (either AgentConfig or DeployedAgent)
 * @returns The appropriate ID for server communication
 */
export declare function getServerAgentId(agent: AgentConfig | DeployedAgent): string;
/**
 * Check if all required configuration parameters are filled for an agent
 * This includes environment variables, dynamic arguments, and input parameters
 * @param agent The agent to check
 * @returns true if all required fields are filled, false otherwise
 */
export declare function isAgentConfigured(agent: any): boolean;
//# sourceMappingURL=agent-utils.d.ts.map