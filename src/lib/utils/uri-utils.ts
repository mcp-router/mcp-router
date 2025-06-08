/**
 * Utilities for handling MCP resource URIs
 */

/**
 * Parse a resource URI into components
 * @param uri The resource URI to parse (format: resource://serverName/path)
 * @returns Parsed components or null if invalid format
 */
export function parseResourceUri(uri: string): { serverName: string; path: string } | null {
  const match = uri.match(/^resource:\/\/([^\/]+)\/(.+)$/);
  
  if (!match) {
    return null;
  }
  
  return {
    serverName: match[1],
    path: match[2]
  };
}

/**
 * Create a resource URI from components
 * @param serverName The name of the server
 * @param path The resource path
 * @returns A standardized resource URI
 */
export function createResourceUri(serverName: string, path: string): string {
  return `resource://${serverName}/${path}`;
}

/**
 * Create a set of URI variants to try when resolving resources
 * @param serverName The name of the server
 * @param path The resource path
 * @param originalProtocol Optional original protocol
 * @returns Array of URI formats to try
 */
export function createUriVariants(
  serverName: string, 
  path: string, 
  originalProtocol?: string
): Array<{ uri: string, description: string }> {
  const uriFormats = [];
  
  // 1. Try with original protocol if available
  if (originalProtocol) {
    uriFormats.push({
      uri: `${originalProtocol}${path}`,
      description: 'original protocol'
    });
  }
  
  // 2. Try with the raw path as is
  uriFormats.push({
    uri: path,
    description: 'original path'
  });
  
  // 3. Try with resource:// prefix
  uriFormats.push({
    uri: `resource://${path}`,
    description: 'resource:// prefix'
  });
  
  return uriFormats;
}
