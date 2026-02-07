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
import {
  McpServerCard,
  RegistryServerWithMeta,
  RegistryResponse,
} from "./McpServerCard";
import type { GitHubStats } from "@mcp_router/shared";
import { McpServerDetailsModal } from "./McpServerDetailsModal";
import { cn } from "@/renderer/utils/tailwind-utils";
import { usePlatformAPI } from "@/renderer/platform-api";
import { sortMcpServers, type McpServerSortOption } from "./sort-mcp-servers";

interface McpServerGridProps {
  searchQuery?: string;
  className?: string;
}

const ITEMS_PER_PAGE = 12;
const FETCH_LIMIT = 100;
const MAX_SERVER_PAGES = 30;

export const McpServerGrid: React.FC<McpServerGridProps> = ({
  searchQuery = "",
  className,
}) => {
  const { t } = useTranslation();
  const platformAPI = usePlatformAPI();
  const [servers, setServers] = useState<RegistryServerWithMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [sortOption, setSortOption] = useState<McpServerSortOption>("stars");
  const [githubStats, setGithubStats] = useState<
    Record<string, GitHubStats | null>
  >({});

  // Modal state
  const [selectedServer, setSelectedServer] =
    useState<RegistryServerWithMeta | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchServers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const dedupedServers: RegistryServerWithMeta[] = [];
      const seenServerNames = new Set<string>();
      let cursor: string | undefined = undefined;
      let pageCount = 0;

      do {
        const response: RegistryResponse =
          await window.electronAPI.marketplaceSearch({
            search: searchQuery || undefined,
            limit: FETCH_LIMIT,
            cursor,
          });

        const responseServers = Array.isArray(response.servers)
          ? response.servers
          : [];

        for (const server of responseServers) {
          const serverName = server?.server?.name;
          if (!serverName || seenServerNames.has(serverName)) {
            continue;
          }
          seenServerNames.add(serverName);
          dedupedServers.push(server);
        }

        cursor = response.metadata.nextCursor || undefined;
        pageCount += 1;
      } while (cursor && pageCount < MAX_SERVER_PAGES);

      setServers(dedupedServers);
      setCurrentPage(0);
    } catch (err) {
      console.error("Failed to fetch marketplace servers:", err);
      setError(err instanceof Error ? err.message : "Failed to load servers");
      setServers([]);
      setCurrentPage(0);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  // Fetch servers when search query changes
  useEffect(() => {
    fetchServers();
  }, [searchQuery, fetchServers]);

  // Fetch GitHub stats for all loaded servers in the background
  useEffect(() => {
    if (servers.length === 0) {
      return;
    }

    // Find all repository URLs that don't have stats yet
    const repoUrls = servers
      .map((s) => s.server.repository?.url)
      .filter((url): url is string => !!url && githubStats[url] === undefined);

    if (repoUrls.length === 0) {
      return;
    }

    // Process in batches of 50 to avoid huge IPC messages
    const BATCH_SIZE = 50;
    const batch = repoUrls.slice(0, BATCH_SIZE);

    platformAPI.marketplace.servers
      .getGitHubStatsBatch(batch)
      .then((stats) => {
        setGithubStats((previous) => ({ ...previous, ...stats }));
      })
      .catch((err) => {
        console.error("Failed to fetch GitHub stats:", err);
      });
  }, [servers, platformAPI, githubStats]);

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages - 1));
  };

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 0));
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
    return sortMcpServers(servers, sortOption, githubStats);
  }, [servers, sortOption, githubStats]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedServers.length / ITEMS_PER_PAGE),
  );
  const paginatedServers = useMemo(() => {
    const start = currentPage * ITEMS_PER_PAGE;
    return sortedServers.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedServers, currentPage]);

  useEffect(() => {
    setCurrentPage(0);
  }, [sortOption]);

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
        <Button onClick={() => fetchServers()} variant="outline">
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
          onValueChange={(value) => setSortOption(value as McpServerSortOption)}
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
            <SelectItem value="name">
              {t("marketplace.servers.sortName", {
                defaultValue: "Name (A-Z)",
              })}
            </SelectItem>
            <SelectItem value="nameDesc">
              {t("marketplace.servers.sortNameDesc", {
                defaultValue: "Name (Z-A)",
              })}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Server Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {paginatedServers.map((server) => (
          <McpServerCard
            key={server.server.name}
            server={server}
            onClick={() => handleServerClick(server)}
            githubStats={githubStats[server.server.repository?.url || ""]}
          />
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevPage}
            disabled={currentPage === 0}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("common.previous", { defaultValue: "Previous" })}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages - 1}
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
