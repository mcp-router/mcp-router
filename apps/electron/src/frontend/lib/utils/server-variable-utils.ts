import { MCPServerConfig, ServerVariable } from "@mcp_router/shared";

export function parseServerVariables(
  env: Record<string, string>,
): ServerVariable[] {
  return Object.entries(env).map(([name, value]) => ({
    name,
    value,
    description: undefined,
  }));
}

export function extractServerVariables(
  server: MCPServerConfig,
): ServerVariable[] {
  const variables: ServerVariable[] = [];

  // Extract from env
  if (server.env) {
    Object.entries(server.env).forEach(([name, value]) => {
      variables.push({
        name,
        value,
        source: "env",
        required: server.required?.includes(name),
      });
    });
  }

  // Extract from inputParams
  if (server.inputParams) {
    Object.entries(server.inputParams).forEach(([name, param]) => {
      variables.push({
        name,
        value: param.default || "",
        description: param.description,
        source: "inputParam",
        required: server.required?.includes(name),
      });
    });
  }

  return variables;
}

export function formatServerVariable(variable: ServerVariable): string {
  return `${variable.name}=${variable.value}`;
}
