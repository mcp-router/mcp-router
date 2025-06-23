import { MCPServerConfig } from "../types/mcp-types";
export interface ServerVariable {
    name: string;
    value: string;
    description?: string;
    source: "env" | "arg" | "inputParam";
    required?: boolean;
}
/**
 * Extract variables from a server configuration
 * @param server MCP server configuration
 * @returns Array of server variables
 */
export declare function extractServerVariables(server: MCPServerConfig): ServerVariable[];
/**
 * Extract variables from multiple server configurations
 * @param servers Array of MCP server configurations
 * @returns Object with server IDs as keys and array of server variables as values
 */
export declare function extractAllServerVariables(servers: MCPServerConfig[]): Record<string, ServerVariable[]>;
//# sourceMappingURL=server-variable-utils.d.ts.map