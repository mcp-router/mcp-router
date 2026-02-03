/**
 * Marketplace domain API for MCP Registry integration
 */

// =============================================================================
// Registry Server Types
// =============================================================================

/**
 * Server package information from the registry
 */
export interface RegistryServerPackage {
  registryType: "npm" | "pypi" | "oci";
  identifier: string;
  runtimeHint?: string;
  transport: {
    type: "stdio" | "sse" | "streamable-http";
  };
}

/**
 * Server icon information
 */
export interface RegistryServerIcon {
  src: string;
  mimeType?: string;
}

/**
 * Server repository information
 */
export interface RegistryServerRepository {
  url: string;
  source: string;
}

/**
 * Server entity from the MCP Registry
 */
export interface RegistryServer {
  name: string;
  description: string;
  version: string;
  title?: string;
  websiteUrl?: string;
  repository?: RegistryServerRepository;
  icons?: RegistryServerIcon[];
  packages?: RegistryServerPackage[];
}

/**
 * Server search result with metadata
 */
export interface RegistryServerResult {
  server: RegistryServer;
  _meta: {
    "io.modelcontextprotocol.registry/official": {
      status: string;
      publishedAt: string;
      isLatest: boolean;
    };
  };
}

// =============================================================================
// Registry Skill Types
// =============================================================================

/**
 * Skill entity from the registry
 */
export interface RegistrySkill {
  id: string;
  name: string;
  description?: string;
  version?: string;
  author?: string;
  repository?: RegistryServerRepository;
  tags?: string[];
  icon?: string;
  /** Total installation count */
  installs?: number;
  /** Origin source (e.g., "vercel-labs/skills") */
  topSource?: string;
}

/**
 * Skill search result with metadata
 */
export interface RegistrySkillResult {
  skill: RegistrySkill;
  _meta: {
    publishedAt: string;
    downloads?: number;
  };
}

// =============================================================================
// GitHub Stats Types
// =============================================================================

/**
 * GitHub repository statistics
 */
export interface GitHubStats {
  /** Number of stars */
  stars: number;
  /** Number of forks */
  forks: number;
  /** Number of open issues */
  openIssues: number;
  /** Number of watchers */
  watchers: number;
}

// =============================================================================
// Search Options
// =============================================================================

/**
 * Options for searching MCP servers in the registry
 */
export interface McpServerSearchOptions {
  /** Search query string */
  search?: string;
  /** Maximum number of results to return */
  limit?: number;
  /** Cursor for pagination */
  cursor?: string;
  /** Filter by registry type */
  registryType?: "npm" | "pypi" | "oci";
  /** Filter by transport type */
  transportType?: "stdio" | "sse" | "streamable-http";
}

/**
 * Options for searching skills in the registry
 */
export interface SkillsSearchOptions {
  /** Search query string */
  search?: string;
  /** Maximum number of results to return */
  limit?: number;
  /** Cursor for pagination */
  cursor?: string;
  /** Filter by tags */
  tags?: string[];
}

// =============================================================================
// Search Responses
// =============================================================================

/**
 * Response metadata for paginated results
 */
export interface SearchResponseMetadata {
  nextCursor: string | null;
  count: number;
}

/**
 * Response for MCP server search
 */
export interface McpServerSearchResponse {
  servers: RegistryServerResult[];
  metadata: SearchResponseMetadata;
}

/**
 * Response for skills search
 */
export interface SkillsSearchResponse {
  skills: RegistrySkillResult[];
  metadata: SearchResponseMetadata;
}

// =============================================================================
// Install Types
// =============================================================================

/**
 * Input for installing a skill from the marketplace
 */
export interface InstallSkillInput {
  /** Skill ID or name from the registry */
  skillId: string;
  /** Repository URL to fetch from */
  repoUrl: string;
  /** Optional target directory name */
  targetName?: string;
  /** Optional project to associate with */
  projectId?: string | null;
}

/**
 * Result of skill installation
 */
export interface InstallSkillResult {
  success: boolean;
  skillId?: string;
  error?: string;
}

// =============================================================================
// Marketplace API Interface
// =============================================================================

/**
 * Marketplace API for browsing and installing MCP servers and skills
 */
export interface MarketplaceAPI {
  /** Server marketplace operations */
  servers: {
    /** Search for MCP servers in the registry */
    search: (
      options?: McpServerSearchOptions,
    ) => Promise<McpServerSearchResponse>;
    /** Get detailed information about a specific server */
    getDetails: (serverName: string) => Promise<RegistryServer | null>;
    /** Fetch README content from the server's repository */
    getReadme: (repoUrl: string) => Promise<string | null>;
    /** Fetch GitHub stats for a repository */
    getGitHubStats: (repoUrl: string) => Promise<GitHubStats | null>;
    /** Batch fetch GitHub stats for multiple repositories */
    getGitHubStatsBatch: (
      repoUrls: string[],
    ) => Promise<Record<string, GitHubStats | null>>;
  };

  /** Skill marketplace operations */
  skills: {
    /** Search for skills in the registry */
    search: (options?: SkillsSearchOptions) => Promise<SkillsSearchResponse>;
    /** Get detailed information about a specific skill */
    getDetails: (skillId: string) => Promise<RegistrySkill | null>;
    /** Fetch skill content from the repository */
    getContent: (repoUrl: string) => Promise<string | null>;
    /** Install a skill from the marketplace */
    install: (skill: InstallSkillInput) => Promise<InstallSkillResult>;
  };

  /** Clear all marketplace caches */
  clearCache: () => Promise<void>;
}
