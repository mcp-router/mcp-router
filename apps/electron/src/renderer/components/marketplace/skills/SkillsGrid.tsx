import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  Skeleton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@mcp_router/ui";
import { IconMoodEmpty } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/renderer/utils/tailwind-utils";
import { usePlatformAPI } from "@/renderer/platform-api";
import { SkillCard } from "./SkillCard";
import { SkillDetailsModal } from "./SkillDetailsModal";
import type {
  SkillsGridProps,
  MarketplaceSkill,
  SkillSortOption,
} from "./types";

/**
 * Skeleton card component for loading state
 */
const SkillCardSkeleton: React.FC = () => (
  <Card className="flex flex-col h-full">
    <CardContent className="p-4 space-y-3">
      <div className="flex items-start justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-12" />
      </div>
      <Skeleton className="h-4 w-24" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
      <div className="flex gap-1">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-16" />
      </div>
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-20" />
      </div>
    </CardContent>
  </Card>
);

/**
 * Empty state component when no skills match the search
 */
const EmptyState: React.FC<{ searchQuery: string }> = ({ searchQuery }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <IconMoodEmpty className="h-16 w-16 text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-medium mb-2">
        {searchQuery
          ? t("marketplace.skills.noResults", {
              defaultValue: "No skills found",
            })
          : t("marketplace.skills.empty", {
              defaultValue: "No skills available",
            })}
      </h3>
      <p className="text-sm text-muted-foreground max-w-md">
        {searchQuery
          ? t("marketplace.skills.noResultsDescription", {
              query: searchQuery,
              defaultValue: `No skills matching "${searchQuery}". Try a different search term.`,
            })
          : t("marketplace.skills.emptyDescription", {
              defaultValue:
                "Skills will appear here once they are available in the marketplace.",
            })}
      </p>
    </div>
  );
};

/**
 * Sorts skills based on the selected sort option
 */
function sortSkills(
  skills: MarketplaceSkill[],
  sortOption: SkillSortOption,
): MarketplaceSkill[] {
  const sorted = [...skills];

  switch (sortOption) {
    case "popular":
      return sorted.sort((a, b) => b.installCount - a.installCount);
    case "trending":
      // For trending, we use a combination of recent updates and install count
      return sorted.sort((a, b) => {
        const aScore =
          new Date(a.updatedAt).getTime() / 1000000000 + a.installCount / 10000;
        const bScore =
          new Date(b.updatedAt).getTime() / 1000000000 + b.installCount / 10000;
        return bScore - aScore;
      });
    case "recent":
      return sorted.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    default:
      return sorted;
  }
}

/**
 * SkillsGrid component displays a grid of marketplace skills
 * Supports search filtering, sorting, and responsive layout
 */
export const SkillsGrid: React.FC<SkillsGridProps> = ({
  searchQuery,
  className,
}) => {
  const { t } = useTranslation();
  const platformAPI = usePlatformAPI();

  // State
  const [skills, setSkills] = useState<MarketplaceSkill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortOption, setSortOption] = useState<SkillSortOption>("popular");
  const [installedSkillIds, setInstalledSkillIds] = useState<Set<string>>(
    new Set(),
  );

  // Modal state
  const [selectedSkill, setSelectedSkill] = useState<MarketplaceSkill | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [readmeContent, setReadmeContent] = useState<string | null>(null);
  const [isLoadingReadme, setIsLoadingReadme] = useState(false);

  // Load marketplace skills
  const loadSkills = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await platformAPI.marketplace.skills.search({
        search: searchQuery.trim() || undefined,
        limit: 50,
      });
      // Handle skills.sh API response format:
      // { skills: [{ id, skillId, name, installs, source }, ...] }
      const mappedSkills = response.skills.map((item: any) => {
        // Check if item has a nested 'skill' property or is the skill directly
        const skill = item.skill ?? item;
        const meta = item._meta ?? {};

        // Extract author from source (e.g., "vercel-labs/skills" -> "vercel-labs")
        const source = skill.source || skill.topSource || "";
        const author = source.split("/")[0] || "Unknown";

        // Construct GitHub repository URL for SKILL.md fetching
        // Format: https://github.com/{source} with skill path skills/{skillId}/SKILL.md
        const skillId = skill.skillId || skill.name;
        const repositoryUrl = source
          ? `https://github.com/${source}#skill:${skillId}`
          : skill.repository?.url;

        return {
          id: skill.id,
          name: skill.name || skillId,
          description: skill.description || "No description available",
          author: skill.author || author,
          version: skill.version || "1.0.0",
          installCount: skill.installs ?? meta.downloads ?? 0,
          tags: skill.tags || [],
          repositoryUrl,
          compatibility: [],
          createdAt: meta.publishedAt || new Date().toISOString(),
          updatedAt: meta.publishedAt || new Date().toISOString(),
        } as MarketplaceSkill;
      });
      setSkills(mappedSkills);
    } catch (error) {
      console.error("Failed to load marketplace skills:", error);
      toast.error(
        t("marketplace.skills.loadError", {
          defaultValue: "Failed to load skills from marketplace",
        }),
      );
    } finally {
      setIsLoading(false);
    }
  }, [platformAPI, searchQuery, t]);

  // Load installed skills to check installation status
  const loadInstalledSkills = useCallback(async () => {
    try {
      const installedSkills = await platformAPI.skills.list();
      const installedNames = new Set(
        installedSkills.map((s) => s.name.toLowerCase()),
      );
      setInstalledSkillIds(installedNames);
    } catch (error) {
      console.error("Failed to load installed skills:", error);
    }
  }, [platformAPI]);

  // Load skills on mount
  useEffect(() => {
    loadSkills();
    loadInstalledSkills();
  }, [loadSkills, loadInstalledSkills]);

  // Filter and sort skills
  const filteredAndSortedSkills = useMemo(() => {
    let filtered = skills;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = skills.filter(
        (skill) =>
          skill.name.toLowerCase().includes(query) ||
          skill.description.toLowerCase().includes(query) ||
          skill.author.toLowerCase().includes(query) ||
          skill.tags.some((tag) => tag.toLowerCase().includes(query)),
      );
    }

    // Apply sorting
    return sortSkills(filtered, sortOption);
  }, [skills, searchQuery, sortOption]);

  // Check if a skill is installed
  const isSkillInstalled = useCallback(
    (skill: MarketplaceSkill): boolean => {
      return installedSkillIds.has(skill.name.toLowerCase());
    },
    [installedSkillIds],
  );

  // Handle skill installation
  const handleInstall = useCallback(
    async (skill: MarketplaceSkill) => {
      try {
        if (!skill.repositoryUrl) {
          throw new Error("Skill repository not available");
        }

        const result = await platformAPI.marketplace.skills.install({
          skillId: skill.id,
          repoUrl: skill.repositoryUrl,
          targetName: skill.name,
        });

        if (!result.success) {
          throw new Error(result.error || "Failed to install skill");
        }

        // Update installed skills set
        setInstalledSkillIds((prev) => {
          const updated = new Set(prev);
          updated.add(skill.name.toLowerCase());
          return updated;
        });

        toast.success(
          t("marketplace.skills.installSuccess", {
            name: skill.name,
            defaultValue: `Successfully installed ${skill.name}`,
          }),
        );

        // Refresh installed skills list
        loadInstalledSkills();
      } catch (error: any) {
        console.error("Failed to install skill:", error);
        toast.error(
          error.message ||
            t("marketplace.skills.installError", {
              defaultValue: "Failed to install skill",
            }),
        );
      }
    },
    [platformAPI, t, loadInstalledSkills],
  );

  // Handle viewing skill details
  const handleViewDetails = useCallback(
    async (skill: MarketplaceSkill) => {
      setSelectedSkill(skill);
      setIsModalOpen(true);
      setReadmeContent(null);

      // Load README content if repository URL is available
      if (skill.repositoryUrl) {
        setIsLoadingReadme(true);
        try {
          const content = await platformAPI.marketplace.skills.getContent(
            skill.repositoryUrl,
          );
          setReadmeContent(content);
        } catch (error) {
          console.error("Failed to load README:", error);
          setReadmeContent(null);
        } finally {
          setIsLoadingReadme(false);
        }
      }
    },
    [platformAPI],
  );

  // Handle modal close
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedSkill(null);
    setReadmeContent(null);
  }, []);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Sort controls */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? t("marketplace.skills.loading", {
                defaultValue: "Loading skills...",
              })
            : t("marketplace.skills.count", {
                count: filteredAndSortedSkills.length,
                defaultValue: `${filteredAndSortedSkills.length} skills`,
              })}
        </p>
        <Select
          value={sortOption}
          onValueChange={(value) => setSortOption(value as SkillSortOption)}
        >
          <SelectTrigger className="w-[140px]" aria-label="Sort skills">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="popular">
              {t("marketplace.skills.sortPopular", { defaultValue: "Popular" })}
            </SelectItem>
            <SelectItem value="trending">
              {t("marketplace.skills.sortTrending", {
                defaultValue: "Trending",
              })}
            </SelectItem>
            <SelectItem value="recent">
              {t("marketplace.skills.sortRecent", { defaultValue: "Recent" })}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Skills grid */}
      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <SkillCardSkeleton key={index} />
          ))}
        </div>
      ) : filteredAndSortedSkills.length === 0 ? (
        <EmptyState searchQuery={searchQuery} />
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredAndSortedSkills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              isInstalled={isSkillInstalled(skill)}
              onInstall={handleInstall}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      )}

      {/* Details modal */}
      <SkillDetailsModal
        skill={selectedSkill}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        isInstalled={selectedSkill ? isSkillInstalled(selectedSkill) : false}
        onInstall={handleInstall}
        readmeContent={readmeContent}
        isLoadingReadme={isLoadingReadme}
      />
    </div>
  );
};

export default SkillsGrid;
