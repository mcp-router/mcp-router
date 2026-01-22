import type {
  SearchRequest,
  SearchResponse,
  SearchResult,
  MCPServer,
  ToolInfo,
} from "@mcp_router/shared";
import type { MCPServerManager } from "@/main/modules/mcp-server-manager/mcp-server-manager";
import { BM25SearchProvider } from "./bm25-search-provider";

/**
 * Search request parameters for search providers.
 */
export type SearchProviderRequest = {
  query: string[];
  context?: string;
  tools: ToolInfo[];
  maxResults?: number;
};

/**
 * Interface for search providers.
 */
export interface SearchProvider {
  search(request: SearchProviderRequest): Promise<SearchResult[]>;
}

type SearchContext = {
  projectId: string | null;
  allowedServerIds?: Set<string>;
  toolCatalogEnabled?: boolean;
};

const DEFAULT_MAX_RESULTS = 20;
const MAX_RESULTS_LIMIT = 100;

export class ToolCatalogService {
  private serverManager: MCPServerManager;
  private searchProvider: SearchProvider;

  constructor(
    serverManager: MCPServerManager,
    searchProvider?: SearchProvider,
  ) {
    this.serverManager = serverManager;
    this.searchProvider = searchProvider ?? new BM25SearchProvider();
  }

  /**
   * Searches for tools matching the query.
   * Collects available tools on-demand from running servers.
   */
  public async searchTools(
    request: SearchRequest,
    context: SearchContext,
  ): Promise<SearchResponse> {
    // Check if tool catalog is enabled for this project
    // Default to enabled if not specified
    if (context.toolCatalogEnabled === false) {
      return { results: [] };
    }

    const query = request.query.filter((q) => q.trim());
    if (query.length === 0) {
      return { results: [] };
    }
    const maxResults = this.normalizeMaxResults(request.maxResults);

    // Collect available tools on-demand
    const availableTools = await this.collectAvailableTools(context);

    if (availableTools.length === 0) {
      return { results: [] };
    }

    // Use search provider
    const results = await this.searchProvider.search({
      query,
      context: request.context,
      tools: availableTools,
      maxResults,
    });

    return { results };
  }

  /**
   * Collects available tools from running servers on-demand.
   * Applies filtering based on context (projectId, allowedServerIds, toolPermissions).
   */
  private async collectAvailableTools(
    context: SearchContext,
  ): Promise<ToolInfo[]> {
    const { servers, clients, serverStatusMap } = this.serverManager.getMaps();
    const tools: ToolInfo[] = [];

    for (const [serverId, client] of clients.entries()) {
      const server = servers.get(serverId);
      if (!server || !client) {
        continue;
      }

      const serverName = server.name || serverId;
      if (!serverStatusMap.get(serverName)) {
        continue;
      }

      if (context.allowedServerIds && !context.allowedServerIds.has(serverId)) {
        continue;
      }

      if (!this.matchesProject(server, context.projectId)) {
        continue;
      }

      const permissions = server.toolPermissions || {};

      try {
        const toolResponse = await client.listTools();
        const toolList = toolResponse?.tools ?? [];

        for (const tool of toolList) {
          if (permissions[tool.name] === false) {
            continue;
          }

          tools.push({
            toolKey: `${serverId}:${tool.name}`,
            serverId,
            toolName: tool.name,
            serverName,
            projectId: server.projectId ?? null,
            description: tool.description,
            inputSchema: tool.inputSchema as ToolInfo["inputSchema"],
          });
        }
      } catch (error) {
        console.error(
          `[ToolCatalog] Failed to list tools from ${serverName}:`,
          error,
        );
      }
    }

    return tools;
  }

  private normalizeMaxResults(value?: number): number {
    if (!value || !Number.isFinite(value)) {
      return DEFAULT_MAX_RESULTS;
    }
    const normalized = Math.max(1, Math.floor(value));
    return Math.min(MAX_RESULTS_LIMIT, normalized);
  }

  public matchesProject(
    server: MCPServer | undefined,
    projectId: string | null,
  ): boolean {
    const serverProject = server?.projectId ?? null;
    return projectId === null || serverProject === projectId;
  }
}
