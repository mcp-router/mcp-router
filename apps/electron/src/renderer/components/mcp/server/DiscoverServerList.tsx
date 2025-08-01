import React from "react";
import { LocalMCPServer } from "@mcp_router/shared";
import { RotateCw, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@mcp_router/ui";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@mcp_router/ui";
import { LoadingCard, MessageCard } from "../common";
import { ServerCard } from "@/renderer/components/mcp/server/ServerCard";

interface DiscoverServerListProps {
  remoteServers: LocalMCPServer[];
  onImportServer: (server: LocalMCPServer) => void;
  isLoading: boolean;
  importingServerIds: Set<string>;
  installedServerIds: Set<string>;
  tabType?: "verified" | "community";
}

const DiscoverServerList: React.FC<DiscoverServerListProps> = ({
  remoteServers,
  onImportServer,
  isLoading,
  importingServerIds,
  installedServerIds,
  tabType = "verified",
}) => {
  const { t } = useTranslation();

  if (isLoading) {
    return <LoadingCard message={t("discoverServers.loading")} />;
  }

  if (remoteServers.length === 0) {
    return (
      <MessageCard
        icon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-auto opacity-50"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        }
        title={t("discoverServers.noServersFound")}
        description={t("discoverServers.tryRefreshing")}
      />
    );
  }

  return (
    <div className="p-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tabType === "verified" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>
                {t("discoverServers.verifyYourServer.title")}
              </CardTitle>
              <CardDescription>
                {t("discoverServers.verifyYourServer.description")}
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button
                className="w-full"
                onClick={() =>
                  window.open("https://mcp-router.net?filter=mine", "_blank")
                }
              >
                {t("discoverServers.verifyYourServer.link")}
              </Button>
            </CardFooter>
          </Card>
        )}
        {tabType === "community" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>{t("discoverServers.addServer.title")}</CardTitle>
              <CardDescription>
                {t("discoverServers.addServer.description")}
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button
                className="w-full"
                onClick={() =>
                  window.open("https://mcp-router.net/mcpservers/new", "_blank")
                }
              >
                {t("discoverServers.addServer.link")}
              </Button>
            </CardFooter>
          </Card>
        )}

        {remoteServers.map((server) => (
          <ServerCard
            key={server.id}
            server={server}
            onClick={() => {
              const url = `https://mcp-router.net/mcpservers/${encodeURIComponent(server.displayId || server.id)}/`;
              window.open(url, "_blank");
            }}
            footer={
              <Button
                onClick={() => onImportServer(server)}
                disabled={
                  importingServerIds.has(server.id) ||
                  installedServerIds.has(server.id)
                }
                className="w-full"
                variant={
                  installedServerIds.has(server.id) ? "secondary" : "default"
                }
              >
                {installedServerIds.has(server.id) ? (
                  <>{t("discoverServers.alreadyInstalled")}</>
                ) : importingServerIds.has(server.id) ? (
                  <>
                    <RotateCw className="mr-2 h-4 w-4 animate-spin" />
                    {t("discoverServers.installing")}
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    {t("discoverServers.install")}
                  </>
                )}
              </Button>
            }
          />
        ))}
      </div>
    </div>
  );
};

export default DiscoverServerList;
