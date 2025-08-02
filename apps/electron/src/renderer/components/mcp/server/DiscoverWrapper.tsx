import React, { useState, useEffect } from "react";
import {
  LocalMCPServer,
  MCPServerConfig,
  PaginatedResponse,
  MCPServer,
  APIMCPServer,
} from "@mcp_router/shared";
import { usePlatformAPI } from "@/renderer/platform-api";
import DiscoverServerList from "./DiscoverServerList";
import Manual from "./Manual";
import ServerSearchBox from "./ServerSearchBox";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@mcp_router/ui";
import { CustomPagination } from "./CustomPagination";
import { useServerStore, useWorkspaceStore } from "@/renderer/stores";

const DiscoverWrapper: React.FC = () => {
  const { t } = useTranslation();
  const platformAPI = usePlatformAPI();
  const { createServer } = useServerStore();
  const { currentWorkspace } = useWorkspaceStore();
  const isRemoteWorkspace = currentWorkspace?.type === "remote";
  const [verifiedServers, setVerifiedServers] = useState<LocalMCPServer[]>([]);
  const [communityServers, setCommunityServers] = useState<LocalMCPServer[]>(
    [],
  );
  const [isLoadingVerifiedServers, setIsLoadingVerifiedServers] =
    useState(false);
  const [isLoadingCommunityServers, setIsLoadingCommunityServers] =
    useState(false);
  const [importingServerIds, setImportingServerIds] = useState<Set<string>>(
    new Set(),
  );
  const [installedServerIds, setInstalledServerIds] = useState<Set<string>>(
    new Set(),
  );
  const [verifiedCurrentPage, setVerifiedCurrentPage] = useState(1);
  const [verifiedTotalPages, setVerifiedTotalPages] = useState(1);
  const [verifiedTotalItems, setVerifiedTotalItems] = useState(0);
  const [verifiedPageLimit, setVerifiedPageLimit] = useState(10);

  const [communityCurrentPage, setCommunityCurrentPage] = useState(1);
  const [communityTotalPages, setCommunityTotalPages] = useState(1);
  const [communityTotalItems, setCommunityTotalItems] = useState(0);
  const [communityPageLimit, setCommunityPageLimit] = useState(10);
  const [verifiedSearchTerm, setVerifiedSearchTerm] = useState("");
  const [communitySearchTerm, setCommunitySearchTerm] = useState("");
  const [debouncedVerifiedSearchTerm, setDebouncedVerifiedSearchTerm] =
    useState("");
  const [debouncedCommunitySearchTerm, setDebouncedCommunitySearchTerm] =
    useState("");

  // Debounce verified search term
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedVerifiedSearchTerm(verifiedSearchTerm);
    }, 500);

    return () => {
      clearTimeout(timerId);
    };
  }, [verifiedSearchTerm]);

  // Debounce community search term
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedCommunitySearchTerm(communitySearchTerm);
    }, 500);

    return () => {
      clearTimeout(timerId);
    };
  }, [communitySearchTerm]);

  // Fetch verified servers when verified search term or page limit changes
  useEffect(() => {
    setVerifiedCurrentPage(1);
    fetchVerifiedServers(1, verifiedPageLimit, debouncedVerifiedSearchTerm);
  }, [debouncedVerifiedSearchTerm, verifiedPageLimit]);

  // Fetch community servers when community search term or page limit changes
  useEffect(() => {
    setCommunityCurrentPage(1);
    fetchCommunityServers(1, communityPageLimit, debouncedCommunitySearchTerm);
  }, [debouncedCommunitySearchTerm, communityPageLimit]);

  // Convert APIMCPServer to LocalMCPServer
  const convertApiServerToLocalServer = (
    apiServer: APIMCPServer,
  ): LocalMCPServer => {
    return {
      id: apiServer.id,
      displayId: apiServer.displayId,
      githubUrl: apiServer.githubUrl || null,
      name: apiServer.name,
      description: apiServer.description,
      userId: apiServer.userId,
      createdAt: apiServer.createdAt,
      updatedAt: apiServer.updatedAt,
      iconUrl: apiServer.iconUrl,
      tags: apiServer.tags,
      latestVersion: apiServer.latestVersion,
    };
  };

  const fetchVerifiedServers = async (
    page = verifiedCurrentPage,
    limit = verifiedPageLimit,
    search = debouncedVerifiedSearchTerm,
  ) => {
    // Fetch verified servers
    setIsLoadingVerifiedServers(true);
    try {
      const verifiedResponse: PaginatedResponse<APIMCPServer> =
        await platformAPI.servers.fetchFromIndex(page, limit, search, true);
      // Convert API servers to LocalMCPServer format
      const localServers = verifiedResponse.data.map(
        convertApiServerToLocalServer,
      );
      setVerifiedServers(localServers);

      // Set pagination data for verified servers
      setVerifiedTotalPages(verifiedResponse.pagination.totalPages);
      setVerifiedTotalItems(verifiedResponse.pagination.total);
      setVerifiedCurrentPage(verifiedResponse.pagination.page);
    } catch (error) {
      console.error("Failed to fetch verified servers:", error);
      setVerifiedServers([]);
    } finally {
      setIsLoadingVerifiedServers(false);
    }
  };

  const fetchCommunityServers = async (
    page = communityCurrentPage,
    limit = communityPageLimit,
    search = debouncedCommunitySearchTerm,
  ) => {
    // Fetch community servers
    setIsLoadingCommunityServers(true);
    try {
      const communityResponse: PaginatedResponse<APIMCPServer> =
        await platformAPI.servers.fetchFromIndex(page, limit, search, false);
      // Convert API servers to LocalMCPServer format
      const localServers = communityResponse.data.map(
        convertApiServerToLocalServer,
      );
      setCommunityServers(localServers);

      // Set pagination data for community servers
      setCommunityTotalPages(communityResponse.pagination.totalPages);
      setCommunityTotalItems(communityResponse.pagination.total);
      setCommunityCurrentPage(communityResponse.pagination.page);
    } catch (error) {
      console.error("Failed to fetch community servers:", error);
      setCommunityServers([]);
    } finally {
      setIsLoadingCommunityServers(false);
    }
  };

  // Function to fetch both types of servers on initial load
  const fetchAllServers = async () => {
    await fetchVerifiedServers();
    await fetchCommunityServers();
  };

  // Fetch all servers on component mount
  useEffect(() => {
    fetchAllServers();
    fetchInstalledServers();
  }, []);

  const fetchInstalledServers = async () => {
    try {
      const servers = await platformAPI.servers.list();
      setInstalledServerIds(
        new Set(servers.map((server: MCPServer) => server.id)),
      );
    } catch (error) {
      console.error("Failed to fetch installed servers:", error);
    }
  };

  const handleVerifiedPageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= verifiedTotalPages) {
      setVerifiedCurrentPage(newPage);
      fetchVerifiedServers(
        newPage,
        verifiedPageLimit,
        debouncedVerifiedSearchTerm,
      );
    }
  };

  const handleVerifiedPageSizeChange = (newPageSize: number) => {
    setVerifiedPageLimit(newPageSize);
    // Reset to first page when changing page size
    setVerifiedCurrentPage(1);
    fetchVerifiedServers(1, newPageSize, debouncedVerifiedSearchTerm);
  };

  const handleCommunityPageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= communityTotalPages) {
      setCommunityCurrentPage(newPage);
      fetchCommunityServers(
        newPage,
        communityPageLimit,
        debouncedCommunitySearchTerm,
      );
    }
  };

  const handleCommunityPageSizeChange = (newPageSize: number) => {
    setCommunityPageLimit(newPageSize);
    // Reset to first page when changing page size
    setCommunityCurrentPage(1);
    fetchCommunityServers(1, newPageSize, debouncedCommunitySearchTerm);
  };

  const handleImportServer = async (server: LocalMCPServer) => {
    // Add this server's ID to the importing set
    setImportingServerIds((prev) => new Set(prev).add(server.id));

    try {
      // First, fetch the server version details to get command and args
      let versionDetails = null;
      if (server.displayId && server.latestVersion) {
        versionDetails = await platformAPI.servers.fetchVersionDetails(
          server.displayId,
          server.latestVersion,
        );
      }

      // Prepare the server config
      const serverConfig: MCPServerConfig = {
        id: server.id,
        name: server.name,
        description: server.description,
        autoStart: false,
        disabled: false,
        serverType: "local",
        env: {},
      };

      // Add version details if available
      if (versionDetails && versionDetails.version) {
        // Command and args from version details
        if (versionDetails.version.command) {
          serverConfig.command = versionDetails.version.command;
        }
        if (versionDetails.version.args) {
          serverConfig.args = versionDetails.version.args;
        }
        // Environment variables
        if (versionDetails.version.envs) {
          serverConfig.env = versionDetails.version.envs;
        }
        // Input parameters from version details
        if (versionDetails.version.inputParams) {
          serverConfig.inputParams = versionDetails.version.inputParams;
        }
        // Other properties
        if (versionDetails.latestVersion) {
          serverConfig.version = versionDetails.latestVersion;
        } else if (server.latestVersion) {
          serverConfig.version = server.latestVersion;
        }
        if (versionDetails.version.verificationStatus) {
          serverConfig.verificationStatus =
            versionDetails.version.verificationStatus;
        } else if (server.verificationStatus) {
          serverConfig.verificationStatus = server.verificationStatus;
        }
      } else {
        // Fallback to old behavior if version details not available
        if (server.command) serverConfig.command = server.command;
        if (server.args) serverConfig.args = server.args;
        if (server.envs) serverConfig.env = server.envs;
        if (server.latestVersion) serverConfig.version = server.latestVersion;
        if (server.verificationStatus)
          serverConfig.verificationStatus = server.verificationStatus;
        if (server.inputParams) serverConfig.inputParams = server.inputParams;
      }
      // Add server using store method which handles refresh
      await createServer(serverConfig);
      // Update installed servers list after successful installation
      await fetchInstalledServers();
    } catch (error) {
      console.error("Failed to add server:", error);
    } finally {
      // Remove this server's ID from the importing set
      setImportingServerIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(server.id);
        return newSet;
      });
    }
  };

  return (
    <div className="space-y-6">

      {isRemoteWorkspace ? (
        // リモートワークスペースの場合、Manualコンポーネントのみを表示
        <div className="space-y-6">
          <h2 className="text-lg font-bold mb-4 text-center">
            {t("discoverServers.title")}
          </h2>
          <Manual />
        </div>
      ) : (
        // ローカルワークスペースの場合、既存のタブ表示
        <Tabs defaultValue="manual" className="space-y-6">
          <div>
            <h2 className="text-lg font-bold mb-4 text-center">
              {t("discoverServers.title")}
            </h2>
            <TabsList className="w-full border-b">
              <TabsTrigger value="registry" className="flex-1">
                {t("discoverServers.tabs.registry")}
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex-1">
                {t("discoverServers.tabs.manual")}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="registry" className="space-y-6">
            <Tabs defaultValue="verified" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="verified">
                  {t("discoverServers.verifiedTab")}
                </TabsTrigger>
                <TabsTrigger value="community">
                  {t("discoverServers.communityTab")}
                </TabsTrigger>
              </TabsList>

              {/* Verified Servers Tab */}
              <TabsContent value="verified" className="space-y-4">
                <ServerSearchBox
                  searchTerm={verifiedSearchTerm}
                  onSearchChange={setVerifiedSearchTerm}
                  placeholderKey="discoverServers.searchVerifiedPlaceholder"
                />
                <DiscoverServerList
                  remoteServers={verifiedServers}
                  onImportServer={handleImportServer}
                  isLoading={isLoadingVerifiedServers}
                  importingServerIds={importingServerIds}
                  installedServerIds={installedServerIds}
                  tabType="verified"
                />

                {/* Verified Pagination controls */}
                {!isLoadingVerifiedServers && (
                  <div className="overflow-x-auto">
                    <CustomPagination
                      currentPage={verifiedCurrentPage}
                      totalPages={verifiedTotalPages}
                      totalItems={verifiedTotalItems}
                      pageSize={verifiedPageLimit}
                      onPageChange={handleVerifiedPageChange}
                      onPageSizeChange={handleVerifiedPageSizeChange}
                      pageSizeOptions={[10, 20, 50]}
                      showPageSizeSelector={true}
                      maxPageButtons={5}
                    />
                  </div>
                )}
              </TabsContent>

              {/* Community Servers Tab */}
              <TabsContent value="community" className="space-y-4">
                <ServerSearchBox
                  searchTerm={communitySearchTerm}
                  onSearchChange={setCommunitySearchTerm}
                  placeholderKey="discoverServers.searchCommunityPlaceholder"
                />
                <DiscoverServerList
                  remoteServers={communityServers}
                  onImportServer={handleImportServer}
                  isLoading={isLoadingCommunityServers}
                  importingServerIds={importingServerIds}
                  installedServerIds={installedServerIds}
                  tabType="community"
                />

                {/* Community Pagination controls */}
                {!isLoadingCommunityServers && (
                  <div className="overflow-x-auto">
                    <CustomPagination
                      currentPage={communityCurrentPage}
                      totalPages={communityTotalPages}
                      totalItems={communityTotalItems}
                      pageSize={communityPageLimit}
                      onPageChange={handleCommunityPageChange}
                      onPageSizeChange={handleCommunityPageSizeChange}
                      pageSizeOptions={[5, 10, 20]}
                      showPageSizeSelector={true}
                      maxPageButtons={5}
                    />
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="manual">
            <Manual />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default DiscoverWrapper;
