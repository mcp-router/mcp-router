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
  const displayName =
    serverData.title || serverData.name.split("/").pop() || serverData.name;

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
        "hover:border-primary/50 hover:soft-shadow transition-all duration-300 cursor-pointer h-full rounded-2xl border-muted/50 bg-card/50 hover:bg-card",
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
      <CardContent className="p-6">
        <div className="flex flex-col gap-6">
          {/* Header with icon and name */}
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-muted/30 flex items-center justify-center overflow-hidden soft-shadow border border-border/40">
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
                  "h-6 w-6 text-muted-foreground/70",
                  iconSrc && "hidden",
                )}
              />
            </div>

            {/* Name and badges */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3
                  className="font-bold text-base truncate tracking-tight"
                  title={serverData.name}
                >
                  {displayName}
                </h3>
                {isVerified && (
                  <Badge
                    variant="secondary"
                    className="h-5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 rounded-full px-2"
                  >
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    <span>Verified</span>
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <span className="bg-muted/50 px-1.5 py-0.5 rounded-md font-mono">
                  v{serverData.version}
                </span>
                {githubStats && (
                  <>
                    <span className="text-muted-foreground/30">•</span>
                    <span
                      className="flex items-center gap-1"
                      title="GitHub stars"
                    >
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium">
                        {formatCount(githubStats.stars)}
                      </span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {truncatedDescription && (
            <p className="text-sm text-muted-foreground/80 line-clamp-2 leading-relaxed">
              {truncatedDescription}
            </p>
          )}

          {/* Package badges */}
          {serverData.packages && serverData.packages.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-auto pt-2">
              {serverData.packages.slice(0, 3).map((pkg, index) => (
                <Badge
                  key={`${pkg.registryType}-${index}`}
                  variant="outline"
                  className="h-6 text-[11px] rounded-full px-2.5 bg-muted/20 border-muted/50 hover:bg-muted/40 transition-colors"
                >
                  {pkg.registryType}
                </Badge>
              ))}
              {serverData.packages.length > 3 && (
                <Badge
                  variant="outline"
                  className="h-6 text-[11px] rounded-full px-2 bg-muted/20 border-muted/50"
                >
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
