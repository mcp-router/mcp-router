import { MCPServerConfig, ServerVariable } from "@mcp_router/shared";

/**
 * Extract variables from a server configuration
 * @param server MCP server configuration
 * @returns Array of server variables
 */
export function extractServerVariables(
  server: MCPServerConfig,
): ServerVariable[] {
  if (!server) return [];

  const variables: ServerVariable[] = [];

  // Extract variables from environment variables
  if (server.env) {
    Object.entries(server.env).forEach(([name, value]) => {
      variables.push({
        name,
        value: value?.toString() || "",
        source: "env",
        required: server.required?.includes(name),
      });
    });
  }

  // Extract variables from args with pattern {variableName}
  if (server.args && Array.isArray(server.args)) {
    server.args.forEach((arg) => {
      if (!arg) return;

      const match = arg.match(/^\{([^}]+)\}$/);
      if (match) {
        const varName = match[1];
        // Check if it's not already in variables
        if (!variables.some((v) => v.name === varName)) {
          variables.push({
            name: varName,
            value: server.env?.[varName]?.toString() || "",
            source: "arg",
            required: server.required?.includes(varName),
          });
        }
      }
    });
  }

  // Extract variables from inputParams
  if (server.inputParams) {
    Object.entries(server.inputParams).forEach(([name, param]) => {
      // Only add if not already in the list from env or args
      if (!variables.some((v) => v.name === name)) {
        variables.push({
          name,
          value: server.env?.[name]?.toString() || param.default || "",
          description: param.description,
          source: "inputParam",
          required: server.required?.includes(name),
        });
      }
    });
  }

  return variables;
}
