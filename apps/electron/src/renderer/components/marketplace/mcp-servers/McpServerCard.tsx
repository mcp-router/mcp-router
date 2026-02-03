import React from "react";
import { Card, CardContent } from "@mcp_router/ui";
import { Badge } from "@mcp_router/ui";
import { CheckCircle2, Server, Calendar, Star, GitFork } from "lucide-react";
import { cn } from "@/renderer/utils/tailwind-utils";

/**
 * Formats ISO date to relative time (e.g., "2 days ago", "3 months ago")
 */
function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

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

export interface RegistryServerWithMeta {
  server: RegistryServer;
  _meta: {
    "io.modelcontextprotocol.registry/official": {
      status: string;
      publishedAt: string;
      updatedAt?: string;
      isLatest: boolean;
    };
  };
}

export interface GitHubStats {
  stars: number;
  forks: number;
  openIssues: number;
  watchers: number;
}

/**
 * Formats large numbers with K/M suffixes
 */
function formatCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

interface McpServerCardProps {
  server: RegistryServerWithMeta;
  onClick: () => void;
  className?: string;
  githubStats?: GitHubStats | null;
}

export const McpServerCard: React.FC<McpServerCardProps> = ({
  server,
  onClick,
  className,
  githubStats,
}) => {
  const { server: serverData, _meta } = server;
  const officialMeta = _meta?.["io.modelcontextprotocol.registry/official"];
  const isVerified = officialMeta?.status === "verified";
  const publishedAt = officialMeta?.publishedAt;

  // Extract a clean display name from the full server name
  // e.g., "ai.aliengiraffe/spotdb" -> "spotdb" or use title if available
  const displayName = serverData.title || serverData.name.split("/").pop() || serverData.name;

  // Get the first icon if available
  const iconSrc = serverData.icons?.[0]?.src;

  // Truncate description to ~100 characters
  const truncatedDescription =
    serverData.description && serverData.description.length > 100
      ? `${serverData.description.substring(0, 100)}...`
      : serverData.description;

  return (
    <Card
      className={cn(
        "hover:border-primary/50 transition-colors cursor-pointer h-full",
        className,
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`View details for ${serverData.title || serverData.name}`}
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          {/* Header with icon and name */}
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
              {iconSrc ? (
                <img
                  src={iconSrc}
                  alt={`${serverData.name} icon`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Hide broken images and show fallback
                    e.currentTarget.style.display = "none";
                    e.currentTarget.nextElementSibling?.classList.remove(
                      "hidden",
                    );
                  }}
                />
              ) : null}
              <Server
                className={cn(
                  "h-5 w-5 text-muted-foreground",
                  iconSrc && "hidden",
                )}
              />
            </div>

            {/* Name and badges */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-medium text-sm truncate" title={serverData.name}>
                  {displayName}
                </h3>
                {isVerified && (
                  <Badge
                    variant="secondary"
                    className="h-5 text-xs flex items-center gap-1"
                  >
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    <span>Verified</span>
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span>v{serverData.version}</span>
                {githubStats && (
                  <>
                    <span className="text-muted-foreground/50">•</span>
                    <span className="flex items-center gap-1" title="GitHub stars">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      {formatCount(githubStats.stars)}
                    </span>
                    <span className="flex items-center gap-1" title="Forks">
                      <GitFork className="h-3 w-3" />
                      {formatCount(githubStats.forks)}
                    </span>
                  </>
                )}
                {publishedAt && !githubStats && (
                  <>
                    <span className="text-muted-foreground/50">•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatRelativeTime(publishedAt)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {truncatedDescription && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {truncatedDescription}
            </p>
          )}

          {/* Package badges */}
          {serverData.packages && serverData.packages.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-auto">
              {serverData.packages.slice(0, 3).map((pkg, index) => (
                <Badge
                  key={`${pkg.registryType}-${index}`}
                  variant="outline"
                  className="h-5 text-xs"
                >
                  {pkg.registryType}
                </Badge>
              ))}
              {serverData.packages.length > 3 && (
                <Badge variant="outline" className="h-5 text-xs">
                  +{serverData.packages.length - 3}
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default McpServerCard;
