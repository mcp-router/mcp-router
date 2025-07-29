import { extractServerVariables } from "@/main/domain/mcp-core/server/shared/server-variable-utils";
import { AgentConfig, DeployedAgent } from "@mcp_router/shared";

/**
 * Agent utility functions
 */

/**
 * Type guard to check if an agent is a DeployedAgent
 * @param agent The agent to check
 * @returns true if the agent is a DeployedAgent
 */
function isDeployedAgent(
  agent: AgentConfig | DeployedAgent,
): agent is DeployedAgent {
  return "originalId" in agent;
}

/**
 * Get the server agent ID for API communication
 * Uses originalId if available (for deployed/shared agents), falls back to local ID
 * @param agent The agent (either AgentConfig or DeployedAgent)
 * @returns The appropriate ID for server communication
 */
export function getServerAgentId(agent: AgentConfig | DeployedAgent): string {
  if (isDeployedAgent(agent) && agent.originalId) {
    return agent.originalId;
  }
  return agent.id;
}

/**
 * Check if all required configuration parameters are filled for an agent
 * This includes environment variables, dynamic arguments, and input parameters
 * @param agent The agent to check
 * @returns true if all required fields are filled, false otherwise
 */
export function isAgentConfigured(agent: any): boolean {
  if (!agent || !agent.mcpServers) {
    return false;
  }

  for (const server of agent.mcpServers) {
    // Extract all variables from the server configuration
    const variables = extractServerVariables(server);

    // If no variables are extracted, consider the server as configured
    if (variables.length === 0) {
      continue;
    }

    // Determine which variables are required
    let requiredVariables: string[];
    if (Array.isArray(server.required) && server.required.length > 0) {
      // Use explicitly defined required fields
      requiredVariables = server.required;
    } else {
      // If no required fields are defined, consider the server as configured
      continue;
    }

    // Check if all required variables have non-empty values
    for (const requiredVar of requiredVariables) {
      const variable = variables.find((v) => v.name === requiredVar);
      if (!variable) {
        // Required variable not found in any source
        return false;
      }

      // Check if the variable has a non-empty value
      if (
        !variable.value ||
        (typeof variable.value === "string" && variable.value.trim() === "")
      ) {
        return false;
      }
    }
  }

  // All required fields are filled
  return true;
}
