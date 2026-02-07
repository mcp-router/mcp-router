import type { GitHubStats } from "@mcp_router/shared";
import type { RegistryServerWithMeta } from "./McpServerCard";

export type McpServerSortOption =
  | "stars"
  | "recent"
  | "updated"
  | "name"
  | "nameDesc";

function getOfficialMeta(server: RegistryServerWithMeta) {
  return server._meta?.["io.modelcontextprotocol.registry/official"];
}

function getDisplayName(server: RegistryServerWithMeta): string {
  return (
    server.server.title ||
    server.server.name.split("/").pop() ||
    server.server.name
  );
}

function parseDate(value?: string): number {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareNameAsc(a: RegistryServerWithMeta, b: RegistryServerWithMeta) {
  return getDisplayName(a).localeCompare(getDisplayName(b));
}

export function sortMcpServers(
  servers: RegistryServerWithMeta[],
  sortOption: McpServerSortOption,
  githubStats: Record<string, GitHubStats | null>,
): RegistryServerWithMeta[] {
  const sorted = [...servers];

  switch (sortOption) {
    case "stars":
      return sorted.sort((a, b) => {
        const aStars = githubStats[a.server.repository?.url || ""]?.stars || 0;
        const bStars = githubStats[b.server.repository?.url || ""]?.stars || 0;
        if (bStars !== aStars) return bStars - aStars;

        const aUpdated = parseDate(
          getOfficialMeta(a)?.updatedAt || getOfficialMeta(a)?.publishedAt,
        );
        const bUpdated = parseDate(
          getOfficialMeta(b)?.updatedAt || getOfficialMeta(b)?.publishedAt,
        );
        if (bUpdated !== aUpdated) return bUpdated - aUpdated;

        return compareNameAsc(a, b);
      });

    case "recent":
      return sorted.sort((a, b) => {
        const aPublished = parseDate(getOfficialMeta(a)?.publishedAt);
        const bPublished = parseDate(getOfficialMeta(b)?.publishedAt);
        if (bPublished !== aPublished) return bPublished - aPublished;
        return compareNameAsc(a, b);
      });

    case "updated":
      return sorted.sort((a, b) => {
        const aUpdated = parseDate(
          getOfficialMeta(a)?.updatedAt || getOfficialMeta(a)?.publishedAt,
        );
        const bUpdated = parseDate(
          getOfficialMeta(b)?.updatedAt || getOfficialMeta(b)?.publishedAt,
        );
        if (bUpdated !== aUpdated) return bUpdated - aUpdated;
        return compareNameAsc(a, b);
      });

    case "name":
      return sorted.sort(compareNameAsc);

    case "nameDesc":
      return sorted.sort((a, b) => compareNameAsc(b, a));

    default:
      return sorted;
  }
}
