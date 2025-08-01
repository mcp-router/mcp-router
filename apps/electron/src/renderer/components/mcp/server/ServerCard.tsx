import React from "react";
import { LocalMCPServer } from "@mcp_router/shared";
import { CheckCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@mcp_router/ui";
import { Badge } from "@mcp_router/ui";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@mcp_router/ui";

interface ServerCardProps {
  server: LocalMCPServer;
  onClick?: () => void;
  footer?: React.ReactNode;
}

export const ServerCard: React.FC<ServerCardProps> = ({
  server,
  onClick,
  footer,
}) => {
  const { t } = useTranslation();

  return (
    <Card>
      <div
        className={
          onClick ? "cursor-pointer transition-colors hover:bg-muted/50" : ""
        }
        onClick={onClick}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start">
            <div className="flex items-center">
              {server.iconUrl && (
                <img
                  src={server.iconUrl}
                  alt={`${server.name} icon`}
                  className="w-6 h-6 rounded-sm mr-2 object-cover"
                />
              )}
              <div className="flex items-center">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg font-medium">
                    {server.name}
                  </CardTitle>
                  {server.latestVersion && (
                    <Badge
                      variant="outline"
                      className="bg-blue-500/10 text-blue-600 border-blue-200 text-xs"
                    >
                      v{server.latestVersion}
                    </Badge>
                  )}
                </div>
                {server.verificationStatus === "verified" && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="ml-1">
                          <CheckCircle className="h-4 w-4 text-blue-500 inline" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t("discoverServers.verified")}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          </div>
          <CardDescription className="line-clamp-2 mt-1">
            {server.description}
          </CardDescription>
        </CardHeader>

        <CardContent className="pb-2">
          <div className="text-xs text-muted-foreground">
            <p>
              {t("discoverServers.updated")}:{" "}
              {new Date(server.updatedAt).toLocaleDateString()}
            </p>

            {server.tags && server.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {server.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </div>

      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  );
};
