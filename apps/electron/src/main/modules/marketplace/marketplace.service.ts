// apps/electron/src/main/modules/marketplace/marketplace.service.ts
import type {
  RegistryResponse,
  RegistryServer,
  MarketplaceSearchOptions,
} from "./marketplace.types";

const REGISTRY_BASE = "https://registry.modelcontextprotocol.io";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const GITHUB_STATS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes for GitHub stats

interface CacheEntry {
  data: RegistryResponse;
  timestamp: number;
}

interface GitHubStats {
  stars: number;
  forks: number;
  openIssues: number;
  watchers: number;
}

interface GitHubStatsCacheEntry {
  data: GitHubStats | null;
  timestamp: number;
}

class MarketplaceService {
  private cache: Map<string, CacheEntry> = new Map();
  private githubStatsCache: Map<string, GitHubStatsCacheEntry> = new Map();

  async searchServers(
    options: MarketplaceSearchOptions = {},
  ): Promise<RegistryResponse> {
    // Validate search parameters
    if (options.search !== undefined) {
      if (typeof options.search !== "string" || options.search.length > 500) {
        throw new Error("Search query too long (max 500 characters)");
      }
    }
    if (options.limit !== undefined) {
      if (
        typeof options.limit !== "number" ||
        options.limit < 1 ||
        options.limit > 100
      ) {
        throw new Error("Invalid limit value (must be 1-100)");
      }
    }

    const cacheKey = JSON.stringify(options);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    const params = new URLSearchParams();
    if (options.search) params.set("search", options.search);
    if (options.limit) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    params.set("version", "latest");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`${REGISTRY_BASE}/v0.1/servers?${params}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          return { servers: [], metadata: { nextCursor: null, count: 0 } };
        }
        throw new Error("Failed to load marketplace data");
      }

      const data = (await response.json()) as RegistryResponse;
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Request timeout. Please check your connection.");
      }
      throw new Error("Failed to connect to marketplace. Please try again.");
    }
  }

  async getServerDetails(serverName: string): Promise<RegistryServer | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(
        `${REGISTRY_BASE}/v0.1/servers/${encodeURIComponent(serverName)}/versions/latest`,
        { headers: { Accept: "application/json" }, signal: controller.signal },
      );
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error("Failed to load server details");
      }

      return response.json();
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Request timeout. Please check your connection.");
      }
      throw new Error("Failed to connect to marketplace. Please try again.");
    }
  }

  async fetchReadme(repoUrl: string): Promise<string | null> {
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return null;

    const [, owner, repo] = match;

    // Validate owner and repo to prevent SSRF attacks
    if (!/^[a-zA-Z0-9_-]+$/.test(owner) || !/^[a-zA-Z0-9_.-]+$/.test(repo)) {
      return null;
    }

    const branches = ["main", "master"];

    for (const branch of branches) {
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) return response.text();
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") {
          console.debug(
            `[Marketplace] Request timeout fetching README from ${branch}`,
          );
        } else {
          console.debug(
            `[Marketplace] Failed to fetch README from ${branch}:`,
            error,
          );
        }
        continue;
      }
    }
    return null;
  }

  /**
   * Fetch GitHub repository stats (stars, forks, etc.)
   * Results are cached for 30 minutes
   */
  async getGitHubStats(repoUrl: string): Promise<GitHubStats | null> {
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return null;

    const [, owner, repo] = match;
    const cleanRepo = repo.replace(/\.git$/, "");

    // Validate owner and repo to prevent SSRF attacks
    if (
      !/^[a-zA-Z0-9_-]+$/.test(owner) ||
      !/^[a-zA-Z0-9_.-]+$/.test(cleanRepo)
    ) {
      return null;
    }

    const cacheKey = `${owner}/${cleanRepo}`;
    const cached = this.githubStatsCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < GITHUB_STATS_CACHE_TTL) {
      return cached.data;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        `https://api.github.com/repos/${owner}/${cleanRepo}`,
        {
          headers: {
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "MCP-Router",
          },
          signal: controller.signal,
        },
      );
      clearTimeout(timeoutId);

      if (!response.ok) {
        this.githubStatsCache.set(cacheKey, {
          data: null,
          timestamp: Date.now(),
        });
        return null;
      }

      const data = await response.json();
      const stats: GitHubStats = {
        stars: data.stargazers_count || 0,
        forks: data.forks_count || 0,
        openIssues: data.open_issues_count || 0,
        watchers: data.subscribers_count || 0,
      };

      this.githubStatsCache.set(cacheKey, {
        data: stats,
        timestamp: Date.now(),
      });
      return stats;
    } catch (error: unknown) {
      console.debug("[Marketplace] Failed to fetch GitHub stats:", error);
      this.githubStatsCache.set(cacheKey, {
        data: null,
        timestamp: Date.now(),
      });
      return null;
    }
  }

  /**
   * Batch fetch GitHub stats for multiple repositories
   * More efficient than individual calls
   */
  async getGitHubStatsBatch(
    repoUrls: string[],
  ): Promise<Map<string, GitHubStats | null>> {
    const results = new Map<string, GitHubStats | null>();

    // Process in parallel with concurrency limit
    const CONCURRENCY = 5;
    const chunks: string[][] = [];
    for (let i = 0; i < repoUrls.length; i += CONCURRENCY) {
      chunks.push(repoUrls.slice(i, i + CONCURRENCY));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(async (url) => {
        const stats = await this.getGitHubStats(url);
        results.set(url, stats);
      });
      await Promise.all(promises);
    }

    return results;
  }

  clearCache(): void {
    this.cache.clear();
    this.githubStatsCache.clear();
  }
}

// Singleton
let instance: MarketplaceService | null = null;

export function getMarketplaceService(): MarketplaceService {
  if (!instance) {
    instance = new MarketplaceService();
  }
  return instance;
}
