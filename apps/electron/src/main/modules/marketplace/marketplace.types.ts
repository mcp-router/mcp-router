// apps/electron/src/main/modules/marketplace/marketplace.types.ts

export interface RegistryServer {
  name: string;
  description: string;
  version: string;
  title?: string;
  websiteUrl?: string;
  repository?: {
    url: string;
    source: string;
  };
  icons?: Array<{
    src: string;
    mimeType?: string;
  }>;
  packages?: Array<{
    registryType: "npm" | "pypi" | "oci";
    identifier: string;
    runtimeHint?: string;
    transport: {
      type: "stdio" | "sse" | "streamable-http";
    };
  }>;
}

export interface RegistryResponse {
  servers: Array<{
    server: RegistryServer;
    _meta: {
      "io.modelcontextprotocol.registry/official": {
        status: string;
        publishedAt: string;
        isLatest: boolean;
      };
    };
  }>;
  metadata: {
    nextCursor: string | null;
    count: number;
  };
}

export interface MarketplaceSearchOptions {
  search?: string;
  limit?: number;
  cursor?: string;
}

// Skills Registry Types

export type SkillsSortOption = "downloads" | "name" | "nameDesc";

export interface SkillsSearchOptions {
  search?: string;
  limit?: number;
  cursor?: string;
  /** Sort option - API support may vary */
  sort?: SkillsSortOption;
}

/**
 * Raw skill data from skills.sh API
 */
interface RegistrySkillApiResponse {
  /** Unique identifier */
  id: string;
  /** Skill ID (kebab-case) */
  skillId: string;
  /** Display name */
  name: string;
  /** Total installation count */
  installs: number;
  /** Origin repository/source (e.g., "vercel-labs/skills") */
  source: string;
}

/**
 * Enriched skill data for frontend consumption
 */
export interface RegistrySkill {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description (may be empty) */
  description?: string;
  /** Version (placeholder if not provided) */
  version?: string;
  /** Author (extracted from source) */
  author?: string;
  /** Repository information */
  repository?: {
    url: string;
    source: string;
  };
  /** Tags */
  tags?: string[];
  /** Icon URL */
  icon?: string;
  /** Total installation count */
  installs: number;
  /** Origin source */
  topSource: string;
}

export interface SkillsRegistryResponse {
  skills: RegistrySkill[];
  metadata: {
    nextCursor: string | null;
    count: number;
  };
}
