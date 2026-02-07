// apps/electron/src/main/modules/marketplace/skills-registry.service.ts

/**
 * Skills Registry Service
 * Integrates with skills.sh API to fetch and search AI agent skills
 */

// Re-export types for consumers that import from this module
export type { SkillsSearchOptions } from "./marketplace.types";

import type {
  SkillsSearchOptions,
  RegistrySkill,
  SkillsRegistryResponse,
} from "./marketplace.types";

const SKILLS_REGISTRY_BASE = "https://skills.sh";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const DEFAULT_SEARCH_QUERY = "ai";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class SkillsRegistryService {
  private cache: Map<string, CacheEntry<unknown>> = new Map();

  private normalizeSkillsResponse(raw: unknown): SkillsRegistryResponse {
    const asObject = (value: unknown): Record<string, unknown> | null =>
      value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : null;

    const root = asObject(raw);
    const dataObj = root ? asObject(root.data) : null;

    const skillsCandidate =
      (root?.skills as unknown) ??
      (dataObj?.skills as unknown) ??
      (Array.isArray(raw) ? raw : []);
    const skills = Array.isArray(skillsCandidate) ? skillsCandidate : [];

    const metadataCandidate =
      (root?.metadata as unknown) ?? (dataObj?.metadata as unknown);
    const metadataObj = asObject(metadataCandidate);
    const hasMoreCandidate =
      (root?.hasMore as unknown) ?? (dataObj?.hasMore as unknown);
    const nextCursorCandidate =
      (root?.nextCursor as unknown) ?? (dataObj?.nextCursor as unknown);

    const nextCursor =
      typeof metadataObj?.nextCursor === "string"
        ? metadataObj.nextCursor
        : typeof nextCursorCandidate === "string"
          ? nextCursorCandidate
          : null;

    const rootCount =
      typeof root?.count === "number"
        ? root.count
        : typeof dataObj?.count === "number"
          ? dataObj.count
          : undefined;

    const count =
      typeof metadataObj?.count === "number"
        ? metadataObj.count
        : typeof rootCount === "number"
          ? rootCount
          : skills.length;

    const hasMore =
      typeof hasMoreCandidate === "boolean"
        ? hasMoreCandidate
        : nextCursor !== null;

    return {
      skills: skills as RegistrySkill[],
      metadata: {
        nextCursor: hasMore ? nextCursor : null,
        count,
      },
    };
  }

  /**
   * Search skills from the skills.sh registry
   */
  async searchSkills(
    options: SkillsSearchOptions = {},
  ): Promise<SkillsRegistryResponse> {
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

    const cacheKey = `search:${JSON.stringify(options)}`;
    const cached = this.cache.get(cacheKey) as
      | CacheEntry<SkillsRegistryResponse>
      | undefined;

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    const normalizedSearch = options.search?.trim() ?? "";

    // skills.sh search endpoint requires at least 2 chars.
    // For empty queries, use a broad default to populate the marketplace.
    if (normalizedSearch.length > 0 && normalizedSearch.length < 2) {
      return {
        skills: [],
        metadata: {
          nextCursor: null,
          count: 0,
        },
      };
    }

    const params = new URLSearchParams();
    params.set("q", normalizedSearch || DEFAULT_SEARCH_QUERY);
    if (options.limit) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);

    const url = `${SKILLS_REGISTRY_BASE}/api/search?${params}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          return {
            skills: [],
            metadata: {
              nextCursor: null,
              count: 0,
            },
          };
        }
        throw new Error("Failed to load skills data");
      }

      const raw = (await response.json()) as unknown;
      const data = this.normalizeSkillsResponse(raw);
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Request timeout. Please check your connection.");
      }
      const details = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to connect to skills registry. Please try again. (${details})`,
      );
    }
  }

  /**
   * Get details for a specific skill by ID
   * Note: skills.sh may not have a dedicated details endpoint,
   * so this searches for the skill and returns the first match
   */
  async getSkillDetails(skillId: string): Promise<RegistrySkill | null> {
    const cacheKey = `details:${skillId}`;
    const cached = this.cache.get(cacheKey) as
      | CacheEntry<RegistrySkill | null>
      | undefined;

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    // Search for the specific skill by ID
    const response = await this.searchSkills({ search: skillId, limit: 50 });

    // Find exact match by ID
    const skill = response.skills.find((s) => s.id === skillId) ?? null;

    this.cache.set(cacheKey, { data: skill, timestamp: Date.now() });
    return skill;
  }

  /**
   * Fetch SKILL.md content from a GitHub repository
   * Uses GitHub Trees API to search the entire repo for SKILL.md files
   * Supports two URL formats:
   * 1. Standard: https://github.com/owner/repo
   * 2. Skill-specific: https://github.com/owner/repo#skill:skillId
   *    -> prefers SKILL.md in paths containing skillId
   */
  async fetchSkillMd(repoUrl: string): Promise<string | null> {
    // Handle both full URLs and owner/repo format
    let owner: string;
    let repo: string;
    let skillId = ""; // Skill ID from URL fragment

    // Check for skill-specific URL format: github.com/owner/repo#skill:skillId
    const skillMatch = repoUrl.match(/#skill:([a-zA-Z0-9_-]+)$/);
    if (skillMatch) {
      skillId = skillMatch[1];
      repoUrl = repoUrl.replace(/#skill:[a-zA-Z0-9_-]+$/, "");
    }

    if (repoUrl.includes("github.com")) {
      const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) return null;
      [, owner, repo] = match;
    } else {
      // Assume owner/repo format (e.g., "vercel-labs/agent-skills")
      const parts = repoUrl.split("/");
      if (parts.length !== 2) return null;
      [owner, repo] = parts;
    }

    // Clean repo name (remove .git suffix if present)
    repo = repo.replace(/\.git$/, "");

    // Validate owner and repo to prevent SSRF attacks
    if (!/^[a-zA-Z0-9_-]+$/.test(owner) || !/^[a-zA-Z0-9_.-]+$/.test(repo)) {
      return null;
    }

    const cacheKey = `skill-content:${owner}/${repo}/${skillId}`;
    const cached = this.cache.get(cacheKey) as
      | CacheEntry<string | null>
      | undefined;

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    // Try to find SKILL.md using GitHub Trees API
    const content = await this.findSkillMdInRepo(owner, repo, skillId);
    this.cache.set(cacheKey, { data: content, timestamp: Date.now() });
    return content;
  }

  /**
   * Search repository tree for SKILL.md files using GitHub API
   * Prefers files in paths matching the skillId if provided
   */
  private async findSkillMdInRepo(
    owner: string,
    repo: string,
    skillId: string,
  ): Promise<string | null> {
    const branches = ["main", "master"];

    for (const branch of branches) {
      try {
        // Fetch repository tree
        const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const treeResponse = await fetch(treeUrl, {
          headers: {
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "MCP-Router",
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!treeResponse.ok) {
          continue;
        }

        const treeData = (await treeResponse.json()) as {
          tree: Array<{ path: string; type: string }>;
        };

        // Find all SKILL.md files
        const skillMdFiles = treeData.tree
          .filter(
            (item) =>
              item.type === "blob" &&
              item.path.toLowerCase().endsWith("skill.md"),
          )
          .map((item) => item.path);

        if (skillMdFiles.length === 0) {
          continue;
        }

        // Score and sort files to find best match
        const scoredFiles = skillMdFiles.map((path) => {
          let score = 0;
          const lowerPath = path.toLowerCase();

          // Prefer exact SKILL.md filename (not readme.md etc)
          if (path.endsWith("SKILL.md") || path.endsWith("skill.md")) {
            score += 10;
          }

          // If skillId provided, prefer paths containing it
          if (skillId) {
            const lowerSkillId = skillId.toLowerCase();
            if (lowerPath.includes(lowerSkillId)) {
              score += 20;
            }
            // Also check without common prefixes
            const prefixless = lowerSkillId.replace(
              /^(vercel|anthropic|openai)-/,
              "",
            );
            if (prefixless !== lowerSkillId && lowerPath.includes(prefixless)) {
              score += 15;
            }
          }

          // Prefer shallower paths (root SKILL.md is good fallback)
          const depth = path.split("/").length;
          score -= depth;

          return { path, score };
        });

        // Sort by score descending
        scoredFiles.sort((a, b) => b.score - a.score);

        // Fetch content of best match
        const bestMatch = scoredFiles[0];
        const contentUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${bestMatch.path}`;

        const contentController = new AbortController();
        const contentTimeoutId = setTimeout(
          () => contentController.abort(),
          10000,
        );

        const contentResponse = await fetch(contentUrl, {
          signal: contentController.signal,
        });
        clearTimeout(contentTimeoutId);

        if (contentResponse.ok) {
          return await contentResponse.text();
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") {
          console.debug(
            `[SkillsRegistry] Request timeout searching repo tree for ${branch}`,
          );
        }
        continue;
      }
    }

    return null;
  }

  /**
   * Clear all cached results
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Singleton
let instance: SkillsRegistryService | null = null;

export function getSkillsRegistryService(): SkillsRegistryService {
  if (!instance) {
    instance = new SkillsRegistryService();
  }
  return instance;
}
