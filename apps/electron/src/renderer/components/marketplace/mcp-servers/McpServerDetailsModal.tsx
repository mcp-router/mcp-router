import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@mcp_router/ui";
import { Button } from "@mcp_router/ui";
import { Badge } from "@mcp_router/ui";
import { ScrollArea } from "@mcp_router/ui";
import { Separator } from "@mcp_router/ui";
import { Skeleton } from "@mcp_router/ui";
import {
  CheckCircle2,
  ExternalLink,
  GitBranch,
  Package,
  Plus,
  Server,
} from "lucide-react";
import { RegistryServerWithMeta } from "./McpServerCard";
import { cn } from "@/renderer/utils/tailwind-utils";

interface McpServerDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: RegistryServerWithMeta;
}

export const McpServerDetailsModal: React.FC<McpServerDetailsModalProps> = ({
  open,
  onOpenChange,
  server,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [readme, setReadme] = useState<string | null>(null);
  const [isLoadingReadme, setIsLoadingReadme] = useState(false);
  const [readmeError, setReadmeError] = useState<string | null>(null);

  const { server: serverData, _meta } = server;
  const isVerified =
    _meta?.["io.modelcontextprotocol.registry/official"]?.status === "verified";
  const publishedAt =
    _meta?.["io.modelcontextprotocol.registry/official"]?.publishedAt;

  // Get the first icon if available
  const iconSrc = serverData.icons?.[0]?.src;

  // Fetch README when modal opens
  useEffect(() => {
    if (open && serverData.repository?.url) {
      setIsLoadingReadme(true);
      setReadmeError(null);

      window.electronAPI
        .marketplaceReadme(serverData.repository.url)
        .then((content: string | null) => {
          setReadme(content);
        })
        .catch((err: Error) => {
          console.error("Failed to fetch README:", err);
          setReadmeError("Failed to load README");
        })
        .finally(() => {
          setIsLoadingReadme(false);
        });
    }
  }, [open, serverData.repository?.url]);

  // Generate command for adding to router based on first package
  const getAddCommand = () => {
    if (!serverData.packages || serverData.packages.length === 0) {
      return null;
    }

    const pkg = serverData.packages[0];
    if (pkg.registryType === "npm") {
      return {
        command: "npx",
        args: `-y ${pkg.identifier}`,
      };
    } else if (pkg.registryType === "pypi") {
      return {
        command: "uvx",
        args: pkg.identifier,
      };
    }
    return null;
  };

  const handleAddToRouter = () => {
    const cmdInfo = getAddCommand();

    // Navigate to add server page with pre-filled data via URL state
    navigate("/servers/add", {
      state: {
        prefill: {
          name: serverData.name,
          command: cmdInfo?.command || "",
          args: cmdInfo?.args || "",
        },
      },
    });

    onOpenChange(false);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="flex-shrink-0 w-14 h-14 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
              {iconSrc ? (
                <img
                  src={iconSrc}
                  alt={`${serverData.name} icon`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    e.currentTarget.nextElementSibling?.classList.remove(
                      "hidden",
                    );
                  }}
                />
              ) : null}
              <Server
                className={cn(
                  "h-7 w-7 text-muted-foreground",
                  iconSrc && "hidden",
                )}
              />
            </div>

            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl flex items-center gap-2 flex-wrap">
                {serverData.title || serverData.name}
                {isVerified && (
                  <Badge
                    variant="secondary"
                    className="text-xs flex items-center gap-1"
                  >
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    <span>Verified</span>
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {serverData.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4">
            <div className="space-y-6 pb-4">
              {/* Metadata */}
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Package className="h-4 w-4" />
                  <span>v{serverData.version}</span>
                </div>

                {publishedAt && (
                  <div className="text-muted-foreground">
                    Published: {formatDate(publishedAt)}
                  </div>
                )}

                {serverData.repository?.url && (
                  <a
                    href={serverData.repository.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-primary hover:underline"
                  >
                    <GitBranch className="h-4 w-4" />
                    <span>Repository</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}

                {serverData.websiteUrl && (
                  <a
                    href={serverData.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>Website</span>
                  </a>
                )}
              </div>

              {/* Packages */}
              {serverData.packages && serverData.packages.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">
                    {t("marketplace.packages", { defaultValue: "Packages" })}
                  </h4>
                  <div className="space-y-2">
                    {serverData.packages.map((pkg, index) => (
                      <div
                        key={`${pkg.registryType}-${index}`}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{pkg.registryType}</Badge>
                          <code className="text-sm font-mono">
                            {pkg.identifier}
                          </code>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {pkg.runtimeHint && (
                            <span>Runtime: {pkg.runtimeHint}</span>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {pkg.transport.type}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* README */}
              <div>
                <h4 className="text-sm font-medium mb-2">
                  {t("marketplace.readme", { defaultValue: "README" })}
                </h4>
                {isLoadingReadme ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/6" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ) : readmeError ? (
                  <p className="text-sm text-muted-foreground italic">
                    {readmeError}
                  </p>
                ) : readme ? (
                  <div className="rounded-lg bg-muted/30 border p-4 max-h-80 overflow-auto">
                    <pre className="text-sm whitespace-pre-wrap font-mono text-muted-foreground">
                      {readme}
                    </pre>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    {t("marketplace.noReadme", {
                      defaultValue: "No README available",
                    })}
                  </p>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Footer with Add button */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close", { defaultValue: "Close" })}
          </Button>
          <Button
            onClick={handleAddToRouter}
            disabled={!serverData.packages || serverData.packages.length === 0}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {t("marketplace.addToRouter", { defaultValue: "Add to Router" })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
