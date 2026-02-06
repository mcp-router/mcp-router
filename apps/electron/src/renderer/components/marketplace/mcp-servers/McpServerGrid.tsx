import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Skeleton,
  Button,
  Card,
  CardContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@mcp_router/ui";
import { AlertCircle, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { McpServerCard, RegistryServerWithMeta } from "./McpServerCard";
import type { GitHubStats } from "@mcp_router/shared";
import { McpServerDetailsModal } from "./McpServerDetailsModal";
import { cn } from "@/renderer/utils/tailwind-utils";
import { usePlatformAPI } from "@/renderer/platform-api";

type SortOption = "stars" | "recent" | "updated" | "verified" | "name";

interface RegistryResponse {
  servers: RegistryServerWithMeta[];
  metadata: {
    nextCursor: string | null;
    count: number;
  };
}

interface McpServerGridProps {
  searchQuery?: string;
  className?: string;
}

const ITEMS_PER_PAGE = 12;

export const McpServerGrid: React.FC<McpServerGridProps> = ({
  searchQuery = "",
  className,
}) => {
  const { t } = useTranslation();
  const platformAPI = usePlatformAPI();
  const [servers, setServers] = useState<RegistryServerWithMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursors, setPrevCursors] = useState<string[]>([]);
  const [currentCursor, setCurrentCursor] = useState<string | undefined>(
    undefined,
  );
  const [sortOption, setSortOption] = useState<SortOption>("stars");
  const [githubStats, setGithubStats] = useState<
    Record<string, GitHubStats | null>
  >({});

  // Modal state
  const [selectedServer, setSelectedServer] =
    useState<RegistryServerWithMeta | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchServers = useCallback(
    async (cursor?: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const response: RegistryResponse =
          await window.electronAPI.marketplaceSearch({
            search: searchQuery || undefined,
            limit: ITEMS_PER_PAGE,
            cursor,
          });

        setServers(response.servers);
        setNextCursor(response.metadata.nextCursor);
      } catch (err) {
        console.error("Failed to fetch marketplace servers:", err);
        setError(err instanceof Error ? err.message : "Failed to load servers");
        setServers([]);
      } finally {
        setIsLoading(false);
      }
    },
    [searchQuery],
  );

  // Fetch servers when search query changes
  useEffect(() => {
    // Reset pagination when search changes
    setPrevCursors([]);
    setCurrentCursor(undefined);
    fetchServers();
  }, [searchQuery, fetchServers]);

  // Fetch GitHub stats for servers with repositories
  useEffect(() => {
    if (servers.length === 0) return;

    const repoUrls = servers
      .map((s) => s.server.repository?.url)
      .filter((url): url is string => !!url);

    if (repoUrls.length === 0) return;

    platformAPI.marketplace.servers
      .getGitHubStatsBatch(repoUrls)
      .then((stats) => {
        setGithubStats(stats);
      })
      .catch((err) => {
        console.error("Failed to fetch GitHub stats:", err);
      });
  }, [servers, platformAPI]);

  const handleNextPage = () => {
    if (nextCursor) {
      // Save current cursor for going back
      if (currentCursor) {
        setPrevCursors((prev) => [...prev, currentCursor]);
      } else {
        setPrevCursors((prev) => [...prev, ""]);
      }
      setCurrentCursor(nextCursor);
      fetchServers(nextCursor);
    }
  };

  const handlePrevPage = () => {
    if (prevCursors.length > 0) {
      const newPrevCursors = [...prevCursors];
      const prevCursor = newPrevCursors.pop();
      setPrevCursors(newPrevCursors);
      setCurrentCursor(prevCursor || undefined);
      fetchServers(prevCursor || undefined);
    }
  };

  const handleServerClick = (server: RegistryServerWithMeta) => {
    setSelectedServer(server);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    // Delay clearing selected server to allow modal close animation
    window.setTimeout(() => setSelectedServer(null), 200);
  };

  // Sort servers based on selected option
  const sortedServers = useMemo(() => {
    const sorted = [...servers];
    const getMeta = (s: RegistryServerWithMeta) =>
      s._meta?.["io.modelcontextprotocol.registry/official"];
    const getStars = (s: RegistryServerWithMeta) =>
      githubStats[s.server.repository?.url || ""]?.stars || 0;

    switch (sortOption) {
      case "stars":
        return sorted.sort((a, b) => getStars(b) - getStars(a));
      case "recent":
        return sorted.sort((a, b) => {
          const aDate = getMeta(a)?.publishedAt || "";
          const bDate = getMeta(b)?.publishedAt || "";
          return new Date(bDate).getTime() - new Date(aDate).getTime();
        });
      case "updated":
        return sorted.sort((a, b) => {
          const aDate = getMeta(a)?.updatedAt || getMeta(a)?.publishedAt || "";
          const bDate = getMeta(b)?.updatedAt || getMeta(b)?.publishedAt || "";
          return new Date(bDate).getTime() - new Date(aDate).getTime();
        });
      case "verified":
        return sorted.sort((a, b) => {
          const aVerified = getMeta(a)?.status === "verified" ? 1 : 0;
          const bVerified = getMeta(b)?.status === "verified" ? 1 : 0;
          return bVerified - aVerified;
        });
      case "name":
        return sorted.sort((a, b) => {
          const aName = a.server.title || a.server.name;
          const bName = b.server.title || b.server.name;
          return aName.localeCompare(bName);
        });
      default:
        return sorted;
    }
  }, [servers, sortOption, githubStats]);

  // Loading skeleton grid
  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <Skeleton className="w-10 h-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                  <Skeleton className="h-10 w-full" />
                  <div className="flex gap-1">
                    <Skeleton className="h-5 w-12" />
                    <Skeleton className="h-5 w-12" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn("flex flex-col items-center py-12", className)}>
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-medium mb-2">
          {t("marketplace.errorTitle", {
            defaultValue: "Failed to load servers",
          })}
        </h3>
        <p className="text-muted-foreground text-center max-w-md mb-4">
          {error}
        </p>
        <Button onClick={() => fetchServers(currentCursor)} variant="outline">
          {t("common.retry", { defaultValue: "Retry" })}
        </Button>
      </div>
    );
  }

  // Empty state
  if (servers.length === 0) {
    return (
      <div className={cn("flex flex-col items-center py-12", className)}>
        <Search className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">
          {t("marketplace.emptyTitle", { defaultValue: "No servers found" })}
        </h3>
        <p className="text-muted-foreground text-center max-w-md">
          {searchQuery
            ? t("marketplace.emptySearchDescription", {
                defaultValue:
                  "No servers match your search. Try a different search term.",
              })
            : t("marketplace.emptyDescription", {
                defaultValue:
                  "No servers are available in the marketplace at this time.",
              })}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Sort controls */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("marketplace.servers.count", {
            count: sortedServers.length,
            defaultValue: `${sortedServers.length} servers`,
          })}
        </p>
        <Select
          value={sortOption}
          onValueChange={(value) => setSortOption(value as SortOption)}
        >
          <SelectTrigger className="w-[160px]" aria-label="Sort servers">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="stars">
              {t("marketplace.servers.sortStars", {
                defaultValue: "Most Stars",
              })}
            </SelectItem>
            <SelectItem value="recent">
              {t("marketplace.servers.sortRecent", {
                defaultValue: "Recently Added",
              })}
            </SelectItem>
            <SelectItem value="updated">
              {t("marketplace.servers.sortUpdated", {
                defaultValue: "Recently Updated",
              })}
            </SelectItem>
            <SelectItem value="verified">
              {t("marketplace.servers.sortVerified", {
                defaultValue: "Verified First",
              })}
            </SelectItem>
            <SelectItem value="name">
              {t("marketplace.servers.sortName", {
                defaultValue: "Name (A-Z)",
              })}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Server Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sortedServers.map((server) => (
          <McpServerCard
            key={server.server.name}
            server={server}
            onClick={() => handleServerClick(server)}
            githubStats={githubStats[server.server.repository?.url || ""]}
          />
        ))}
      </div>

      {/* Pagination Controls */}
      {(prevCursors.length > 0 || nextCursor) && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevPage}
            disabled={prevCursors.length === 0}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("common.previous", { defaultValue: "Previous" })}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={!nextCursor}
            className="flex items-center gap-1"
          >
            {t("common.next", { defaultValue: "Next" })}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Details Modal */}
      {selectedServer && (
        <McpServerDetailsModal
          open={isModalOpen}
          onOpenChange={handleCloseModal}
          server={selectedServer}
        />
      )}
    </div>
  );
};
