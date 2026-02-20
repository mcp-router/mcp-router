import type {
  SearchRequest,
  SearchResponse,
  MCPServer,
  ToolInfo,
  SearchProvider,
  SearchProviderRequest,
} from "@mcp_router/shared";
import type { MCPServerManager } from "@/main/modules/mcp-server-manager/mcp-server-manager";
import { MiniSearchProvider } from "./minisearch-provider";
import { normalizeToolInputSchema } from "@/main/modules/mcp-server-runtime/schema-normalizer";

// Internal type for search context filtering

type SearchContext = {
  projectId: string | null;
  allowedServerIds?: Set<string>;
  toolCatalogEnabled?: boolean;
  stripCombinators?: boolean;
};

const DEFAULT_MAX_RESULTS = 10; // Reduced from 20 for token efficiency
const MAX_RESULTS_LIMIT = 100;

export class ToolCatalogService {
  private serverManager: MCPServerManager;
  private searchProvider: SearchProvider;
  private toolCache: {
    tools: ToolInfo[];
    hash: string;
    timestamp: number;
  } | null = null;
  private readonly TOOL_CACHE_TTL_MS = 5000;

  constructor(
    serverManager: MCPServerManager,
    searchProvider?: SearchProvider,
  ) {
    this.serverManager = serverManager;
    // Default to MiniSearch for better fuzzy matching and synonym support
    this.searchProvider = searchProvider ?? new MiniSearchProvider();
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
    const detailLevel = request.detailLevel || "summary";

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
      detailLevel,
    });

    return { results };
  }

  /**
   * Collects available tools from running servers on-demand.
   * Uses a TTL-based cache to avoid repeated queries within a short window.
   * Applies filtering based on context (projectId, allowedServerIds, toolPermissions).
   */
  private async collectAvailableTools(
    context: SearchContext,
  ): Promise<ToolInfo[]> {
    const { servers, clients, serverStatusMap } = this.serverManager.getMaps();
    const stripCombinators = context.stripCombinators === true;

    // Build eligible server list and compute a cache key from it
    const eligibleServers: {
      serverId: string;
      server: MCPServer;
      serverName: string;
      client: ReturnType<typeof clients.get>;
    }[] = [];
    const hashParts: string[] = [];

    for (const [serverId, client] of clients.entries()) {
      const server = servers.get(serverId);
      if (!server || !client) continue;

      const serverName = server.name || serverId;
      if (!serverStatusMap.get(serverName)) continue;
      if (context.allowedServerIds && !context.allowedServerIds.has(serverId))
        continue;
      if (!this.matchesProject(server, context.projectId)) continue;

      eligibleServers.push({ serverId, server, serverName, client });
      hashParts.push(serverId);
    }

    const hash = `${hashParts.sort().join(",")}|strip:${stripCombinators ? "1" : "0"}`;

    // Return cached results if still valid
    if (
      this.toolCache &&
      this.toolCache.hash === hash &&
      Date.now() - this.toolCache.timestamp < this.TOOL_CACHE_TTL_MS
    ) {
      return this.toolCache.tools;
    }

    // Query all eligible servers in parallel
    const results = await Promise.allSettled(
      eligibleServers.map(async ({ serverId, server, serverName, client }) => {
        const permissions = server.toolPermissions || {};
        const toolResponse = await client!.getClient().listTools();
        const toolList = toolResponse?.tools ?? [];
        const tools: ToolInfo[] = [];

        for (const tool of toolList) {
          if (permissions[tool.name] === false) continue;

          tools.push({
            toolKey: `${serverId}:${tool.name}`,
            serverId,
            toolName: tool.name,
            serverName,
            projectId: server.projectId ?? null,
            description: tool.description,
            inputSchema: (normalizeToolInputSchema(tool.inputSchema, {
              stripCombinators,
            }) ??
              tool.inputSchema) as ToolInfo["inputSchema"],
            outputSchema: tool.outputSchema,
            annotations: tool.annotations as ToolInfo["annotations"],
          });
        }
        return tools;
      }),
    );

    const tools: ToolInfo[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        tools.push(...result.value);
      } else {
        console.error(
          "[ToolCatalog] Failed to list tools from server:",
          result.reason,
        );
      }
    }

    // Update cache
    this.toolCache = { tools, hash, timestamp: Date.now() };

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

  public getServerManager(): MCPServerManager {
    return this.serverManager;
  }
}
