import { MCPServer } from "@mcp_router/shared";

/**
 * Check if a server has unset required input parameters
 * @param server - The MCP server to check
 * @returns true if there are required parameters that are not set in env
 */
export function hasUnsetRequiredParams(server: MCPServer): boolean {
  // If no inputParams, nothing to check
  if (!server.inputParams) {
    return false;
  }

  // Check each input parameter
  for (const [paramKey, paramConfig] of Object.entries(server.inputParams)) {
    // If the parameter is required
    if (paramConfig.required) {
      // Check if it's set in env
      const envValue = server.env?.[paramKey];
      
      // If not set or empty string, it's unset
      if (!envValue || envValue.trim() === "") {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get list of unset required parameters
 * @param server - The MCP server to check
 * @returns Array of parameter names that are required but not set
 */
export function getUnsetRequiredParams(server: MCPServer): string[] {
  const unsetParams: string[] = [];
  
  if (!server.inputParams) {
    return unsetParams;
  }

  for (const [paramKey, paramConfig] of Object.entries(server.inputParams)) {
    if (paramConfig.required) {
      const envValue = server.env?.[paramKey];
      if (!envValue || envValue.trim() === "") {
        unsetParams.push(paramKey);
      }
    }
  }

  return unsetParams;
}