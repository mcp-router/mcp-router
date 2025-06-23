/**
 * Validates a JSON input for MCP server configuration format
 * Works with both mcpServers object wrapper and direct server configurations
 *
 * @param jsonInput The JSON input string or object to validate
 * @returns Validation result with parsed data if valid
 */
export declare function validateMcpServerJson(jsonInput: string | object): {
    valid: boolean;
    error?: string;
    jsonData?: any;
    serverConfigs?: Record<string, any>;
};
/**
 * Processes MCP server configurations from validated JSON
 * Handles duplicate names by creating unique names
 *
 * @param serverConfigs The validated server configurations object
 * @param existingServerNames Set of existing server names to avoid duplicates
 * @returns Array of processed server configurations
 */
export declare function processMcpServerConfigs(serverConfigs: Record<string, any>, existingServerNames: Set<string>): Array<{
    name: string;
    originalName?: string;
    success: boolean;
    server?: any;
    message?: string;
}>;
//# sourceMappingURL=mcp-server-utils.d.ts.map