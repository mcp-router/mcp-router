import { APIMCPServer, PaginatedResponse } from "@mcp_router/shared";
import { API_BASE_URL } from "../../../../main";

// Use dynamic import for ESM-only modules
let fetchFunc: any = null;

// Initialize dynamic imports
async function initDynamicImports() {
  try {
    const nodeFetch = await import("node-fetch");
    fetchFunc = nodeFetch.default;
  } catch (error) {
    console.error("Failed to import node-fetch:", error);
    // Use a fallback
    fetchFunc = global.fetch;
  }
}

export async function fetchMcpServersFromIndex(
  page: number = 1,
  limit: number = 20,
  search?: string,
  isVerified?: boolean,
): Promise<PaginatedResponse<APIMCPServer>> {
  try {
    // Make sure fetchFunc is initialized
    if (!fetchFunc) {
      await initDynamicImports();
    }

    // Build URL with query parameters
    const url = new URL(`${API_BASE_URL}/mcpservers`);
    url.searchParams.append("page", page.toString());
    url.searchParams.append("limit", limit.toString());

    if (search) {
      url.searchParams.append("search", search);
    }

    if (isVerified !== undefined) {
      url.searchParams.append("isVerified", isVerified.toString());
    }

    const response = await fetchFunc(url.toString());

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const result: PaginatedResponse<APIMCPServer> = await response.json();
    // console.log('Fetched MCP servers from index server:', result);
    return result;
  } catch (error) {
    console.error("Failed to fetch MCP servers from index server:", error);
    // Return empty paginated response on error
    return {
      data: [],
      pagination: {
        total: 0,
        page: page,
        limit: limit,
        totalPages: 0,
      },
    };
  }
}

export async function fetchMcpServerVersionDetails(
  displayId: string,
  version: string,
): Promise<any> {
  try {
    // Make sure fetchFunc is initialized
    if (!fetchFunc) {
      await initDynamicImports();
    }

    // Build URL for server version details
    const url = `${API_BASE_URL}/mcpservers/${displayId}/versions/${version}`;

    const response = await fetchFunc(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const result = await response.json();
    // console.log('Fetched MCP server version details:', result);
    return result;
  } catch (error) {
    console.error("Failed to fetch MCP server version details:", error);
    return null;
  }
}
