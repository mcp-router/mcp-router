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

      // If not set in env, check if there's a default value in inputParams
      if (!envValue || envValue.trim() === "") {
        // Check if there's a default value
        const defaultValue = paramConfig.default;
        if (
          defaultValue === undefined ||
          defaultValue === null ||
          String(defaultValue).trim() === ""
        ) {
          return true;
        }
      }
    }
  }

  return false;
}
