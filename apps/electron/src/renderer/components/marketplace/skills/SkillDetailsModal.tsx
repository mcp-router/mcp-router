import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Badge,
  Skeleton,
  ScrollArea,
} from "@mcp_router/ui";
import {
  IconDownload,
  IconCheck,
  IconUser,
  IconStar,
  IconBrandGithub,
  IconCalendar,
  IconRefresh,
  IconExternalLink,
} from "@tabler/icons-react";
import type { SkillDetailsModalProps, SkillCompatibility } from "./types";

/**
 * Formats large numbers with K/M suffixes
 */
function formatInstallCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

/**
 * Returns display name for compatibility badges
 */
function getCompatibilityLabel(compat: SkillCompatibility): string {
  const labels: Record<SkillCompatibility, string> = {
    "claude-code": "Claude Code",
    cursor: "Cursor",
    windsurf: "Windsurf",
    cline: "Cline",
    "roo-code": "Roo Code",
  };
  return labels[compat] || compat;
}

/**
 * Formats ISO date string to readable format
 */
function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Parses YAML frontmatter from SKILL.md content
 * Returns the extracted metadata and the content without frontmatter
 */
function parseSkillFrontmatter(content: string): {
  description?: string;
  author?: string;
  version?: string;
  license?: string;
  body: string;
} {
  const frontmatterMatch = content.match(
    /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/,
  );
  if (!frontmatterMatch) {
    return { body: content };
  }

  const [, frontmatter, body] = frontmatterMatch;
  const result: ReturnType<typeof parseSkillFrontmatter> = {
    body: body.trim(),
  };

  // Simple YAML parsing for common fields
  const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
  if (descMatch) {
    result.description = descMatch[1].trim();
  }

  const authorMatch = frontmatter.match(/^\s*author:\s*(.+)$/m);
  if (authorMatch) {
    result.author = authorMatch[1].trim();
  }

  const versionMatch = frontmatter.match(
    /^\s*version:\s*["']?([^"'\n]+)["']?$/m,
  );
  if (versionMatch) {
    result.version = versionMatch[1].trim();
  }

  const licenseMatch = frontmatter.match(/^license:\s*(.+)$/m);
  if (licenseMatch) {
    result.license = licenseMatch[1].trim();
  }

  return result;
}

/**
 * SkillDetailsModal displays full details of a marketplace skill
 * Including SKILL.md content preview, compatibility info, and install button
 */
export const SkillDetailsModal: React.FC<SkillDetailsModalProps> = ({
  skill,
  isOpen,
  onClose,
  isInstalled,
  onInstall,
  readmeContent,
  isLoadingReadme = false,
}) => {
  const { t } = useTranslation();
  const [isInstalling, setIsInstalling] = useState(false);

  if (!skill) return null;

  // Parse SKILL.md frontmatter to extract description and metadata
  const parsedContent = readmeContent
    ? parseSkillFrontmatter(readmeContent)
    : null;
  const effectiveDescription =
    parsedContent?.description ||
    (skill.description !== "No description available"
      ? skill.description
      : null);
  const effectiveAuthor = parsedContent?.author || skill.author;
  const effectiveVersion = parsedContent?.version || skill.version;

  const handleInstall = async () => {
    if (isInstalled || isInstalling) return;

    setIsInstalling(true);
    try {
      await onInstall(skill);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleOpenRepository = () => {
    if (skill.repositoryUrl) {
      window.open(skill.repositoryUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl font-semibold">
                {skill.name}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {effectiveDescription ||
                  t("marketplace.skills.noDescription", {
                    defaultValue: "No description available",
                  })}
              </DialogDescription>
            </div>
            {skill.rating && (
              <div
                className="flex items-center gap-1 text-sm"
                aria-label={t("marketplace.skills.rating", {
                  rating: skill.rating,
                  defaultValue: `Rating: ${skill.rating} out of 5`,
                })}
              >
                <IconStar className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                <span className="font-medium">{skill.rating.toFixed(1)}</span>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4">
            {/* Metadata section */}
            <div className="space-y-4 py-4">
              {/* Author and version info */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <IconUser className="h-4 w-4" />
                  <span>{effectiveAuthor}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">v{effectiveVersion}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <IconDownload className="h-4 w-4" />
                  <span>
                    {formatInstallCount(skill.installCount)}{" "}
                    {t("marketplace.skills.installs", {
                      defaultValue: "installs",
                    })}
                  </span>
                </div>
              </div>

              {/* Dates */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <IconCalendar className="h-4 w-4" />
                  <span>
                    {t("marketplace.skills.created", {
                      defaultValue: "Created",
                    })}
                    : {formatDate(skill.createdAt)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <IconRefresh className="h-4 w-4" />
                  <span>
                    {t("marketplace.skills.updated", {
                      defaultValue: "Updated",
                    })}
                    : {formatDate(skill.updatedAt)}
                  </span>
                </div>
              </div>

              {/* Tags */}
              <div>
                <h4 className="text-sm font-medium mb-2">
                  {t("marketplace.skills.tags", { defaultValue: "Tags" })}
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {skill.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Compatibility */}
              <div>
                <h4 className="text-sm font-medium mb-2">
                  {t("marketplace.skills.compatibility", {
                    defaultValue: "Compatible with",
                  })}
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {skill.compatibility.map((compat) => (
                    <Badge key={compat} variant="outline" className="text-xs">
                      {getCompatibilityLabel(compat)}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Repository link */}
              {skill.repositoryUrl && (
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenRepository}
                    className="gap-2"
                  >
                    <IconBrandGithub className="h-4 w-4" />
                    {t("marketplace.skills.viewRepository", {
                      defaultValue: "View Repository",
                    })}
                    <IconExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {/* README / SKILL.md content */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">
                  {t("marketplace.skills.readme", { defaultValue: "SKILL.md" })}
                </h4>
                {isLoadingReadme ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                ) : parsedContent ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap text-sm bg-muted/50 p-4 rounded-lg overflow-auto max-h-64">
                      {parsedContent.body || readmeContent}
                    </pre>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    {t("marketplace.skills.noReadme", {
                      defaultValue: "No SKILL.md content available",
                    })}
                  </p>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose}>
            {t("common.close", { defaultValue: "Close" })}
          </Button>
          <Button
            variant={isInstalled ? "outline" : "default"}
            disabled={isInstalled || isInstalling}
            onClick={handleInstall}
            className="min-w-[100px]"
          >
            {isInstalling ? (
              <span className="animate-pulse">
                {t("marketplace.skills.installing", {
                  defaultValue: "Installing...",
                })}
              </span>
            ) : isInstalled ? (
              <>
                <IconCheck className="h-4 w-4 mr-2" />
                {t("marketplace.skills.installed", {
                  defaultValue: "Installed",
                })}
              </>
            ) : (
              <>
                <IconDownload className="h-4 w-4 mr-2" />
                {t("marketplace.skills.install", { defaultValue: "Install" })}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
