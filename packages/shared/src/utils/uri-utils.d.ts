/**
 * Utilities for handling MCP resource URIs
 */
/**
 * Parse a resource URI into components
 * @param uri The resource URI to parse (format: resource://serverName/path)
 * @returns Parsed components or null if invalid format
 */
export declare function parseResourceUri(uri: string): {
    serverName: string;
    path: string;
} | null;
/**
 * Create a resource URI from components
 * @param serverName The name of the server
 * @param path The resource path
 * @returns A standardized resource URI
 */
export declare function createResourceUri(serverName: string, path: string): string;
/**
 * Create a set of URI variants to try when resolving resources
 * @param serverName The name of the server
 * @param path The resource path
 * @param originalProtocol Optional original protocol
 * @returns Array of URI formats to try
 */
export declare function createUriVariants(serverName: string, path: string, originalProtocol?: string): Array<{
    uri: string;
    description: string;
}>;
//# sourceMappingURL=uri-utils.d.ts.map