/**
 * Utilities for handling MCP resource URIs
 */

/**
 * Parse a resource URI into components
 * @param uri The resource URI to parse (format: resource://serverName/path)
 * @returns Parsed components or null if invalid format
 */
export function parseResourceUri(
  uri: string,
): { serverName: string; path: string } | null {
  const match = uri.match(/^resource:\/\/([^\/]+)\/(.+)$/);

  if (!match) {
    return null;
  }

  return {
    serverName: match[1],
    path: match[2],
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
  originalProtocol?: string,
): Array<{ uri: string; description: string }> {
  const uriFormats = [];

  // 1. Try with original protocol if available
  if (originalProtocol) {
    const normalizedProtocol = originalProtocol.includes("://")
      ? originalProtocol
      : `${originalProtocol}://`;
    uriFormats.push({
      uri: `${normalizedProtocol}${path}`,
      description: "original protocol",
    });
  }

  // 2. Try with the raw path as is
  uriFormats.push({
    uri: path,
    description: "original path",
  });

  // 3. Try with resource:// prefix
  uriFormats.push({
    uri: `resource://${path}`,
    description: "resource:// prefix",
  });

  return uriFormats;
}

/**
 * Transform resource URIs in tool results to use router's namespace
 * This ensures resource links in tool results point to the router, not backend servers
 */
export function transformResourceLinksInResult(
  result: any,
  serverName: string,
): any {
  if (!result) return result;

  // Handle array of content items
  if (Array.isArray(result.content)) {
    return {
      ...result,
      content: result.content.map((item: any) =>
        transformResourceContentItem(item, serverName),
      ),
    };
  }

  return result;
}

/**
 * Transform a single content item that may contain resource links
 */
function transformResourceContentItem(item: any, serverName: string): any {
  if (!item || typeof item !== "object") return item;

  // Handle resource type content
  if (item.type === "resource" && item.resource?.uri) {
    return {
      ...item,
      resource: {
        ...item.resource,
        uri: createResourceUri(serverName, item.resource.uri),
      },
    };
  }

  // Handle embedded resources in text
  if (item.type === "text" && item.annotations?.resourceLinks) {
    return {
      ...item,
      annotations: {
        ...item.annotations,
        resourceLinks: item.annotations.resourceLinks.map((link: any) => ({
          ...link,
          uri: createResourceUri(serverName, link.uri),
        })),
      },
    };
  }

  return item;
}
