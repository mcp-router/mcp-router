import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Button,
  Badge,
} from "@mcp_router/ui";
import {
  IconDownload,
  IconCheck,
  IconUser,
  IconStar,
} from "@tabler/icons-react";
import { cn } from "@/renderer/utils/tailwind-utils";
import type { SkillCardProps, SkillCompatibility } from "./types";

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
 * SkillCard component displays a skill from the marketplace
 * Shows skill name, description, author, install count, and install button
 */
export const SkillCard: React.FC<SkillCardProps> = ({
  skill,
  isInstalled,
  onInstall,
  onViewDetails,
}) => {
  const { t } = useTranslation();
  const [isInstalling, setIsInstalling] = useState(false);

  const handleInstall = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isInstalled || isInstalling) return;

    setIsInstalling(true);
    try {
      await onInstall(skill);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleCardClick = () => {
    onViewDetails(skill);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onViewDetails(skill);
    }
  };

  return (
    <Card
      className={cn(
        "flex flex-col h-full cursor-pointer transition-all duration-200",
        "hover:border-primary/50 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={t("marketplace.skills.viewDetails", {
        name: skill.name,
        defaultValue: `View details for ${skill.name}`,
      })}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold leading-tight">
            {skill.name}
          </CardTitle>
          {skill.rating && (
            <div
              className="flex items-center gap-1 text-sm text-muted-foreground"
              aria-label={t("marketplace.skills.rating", {
                rating: skill.rating,
                defaultValue: `Rating: ${skill.rating} out of 5`,
              })}
            >
              <IconStar className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span>{skill.rating.toFixed(1)}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <IconUser className="h-3.5 w-3.5" />
          <span>{skill.author}</span>
          <span className="text-muted-foreground/50">|</span>
          <span>v{skill.version}</span>
        </div>
      </CardHeader>

      <CardContent className="flex-1 pb-2">
        {/* Tags */}
        <div className="flex flex-wrap gap-1 mt-3">
          {skill.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs px-2 py-0">
              {tag}
            </Badge>
          ))}
          {skill.tags.length > 3 && (
            <Badge variant="outline" className="text-xs px-2 py-0">
              +{skill.tags.length - 3}
            </Badge>
          )}
        </div>

        {/* Compatibility badges */}
        <div className="flex flex-wrap gap-1 mt-2">
          {skill.compatibility.slice(0, 2).map((compat) => (
            <Badge
              key={compat}
              variant="outline"
              className="text-xs px-1.5 py-0 text-muted-foreground"
            >
              {getCompatibilityLabel(compat)}
            </Badge>
          ))}
          {skill.compatibility.length > 2 && (
            <Badge
              variant="outline"
              className="text-xs px-1.5 py-0 text-muted-foreground"
            >
              +{skill.compatibility.length - 2}
            </Badge>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-2 flex items-center justify-between">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <IconDownload className="h-4 w-4" />
          <span>{formatInstallCount(skill.installCount)}</span>
        </div>

        <Button
          size="sm"
          variant={isInstalled ? "outline" : "default"}
          disabled={isInstalled || isInstalling}
          onClick={handleInstall}
          className="min-w-[80px]"
          aria-label={
            isInstalled
              ? t("marketplace.skills.installed", { defaultValue: "Installed" })
              : t("marketplace.skills.install", { defaultValue: "Install" })
          }
        >
          {isInstalling ? (
            <span className="animate-pulse">
              {t("marketplace.skills.installing", {
                defaultValue: "Installing...",
              })}
            </span>
          ) : isInstalled ? (
            <>
              <IconCheck className="h-4 w-4 mr-1" />
              {t("marketplace.skills.installed", { defaultValue: "Installed" })}
            </>
          ) : (
            <>
              <IconDownload className="h-4 w-4 mr-1" />
              {t("marketplace.skills.install", { defaultValue: "Install" })}
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};
