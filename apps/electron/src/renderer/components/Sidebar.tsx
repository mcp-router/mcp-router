import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  IconSettings,
  IconServer,
  IconActivity,
  IconDeviceDesktop,
  IconDownload,
  IconWand,
  IconBuildingStore,
  IconArrowsShuffle,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useWorkspaceStore } from "@/renderer/stores";
import { usePlatformAPI } from "@/renderer/platform-api";
// @ts-expect-error: Webpack file-loader provides typing for image assets at runtime
import iconImage from "../../../public/images/icon/icon.png";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@mcp_router/ui";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@mcp_router/ui";

const SidebarComponent: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const currentWorkspace = useWorkspaceStore((state) => state.currentWorkspace);
  const isRemoteWorkspace = currentWorkspace?.type === "remote";
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const platformAPI = usePlatformAPI();

  useEffect(() => {
    // Check if an update is available on mount
    platformAPI.packages.system
      .checkForUpdates()
      .then(({ updateAvailable }) => {
        setUpdateAvailable(updateAvailable);
      });

    // Listen for future update availability
    const unsubscribe = platformAPI.packages.system.onUpdateAvailable(
      (available) => {
        setUpdateAvailable(available);
      },
    );

    return () => {
      unsubscribe();
    };
  }, []);

  const handleInstallUpdate = () => {
    platformAPI.packages.system.installUpdate();
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0 bg-transparent">
      <div className="pt-[50px]" />
      <SidebarHeader className="py-4 px-4 overflow-hidden">
        <Link
          to="/"
          className="flex items-center no-underline transition-opacity hover:opacity-80 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <div className="bg-primary/10 p-2 rounded-xl group-data-[collapsible=icon]:mr-0 mr-3 shrink-0 shadow-sm shadow-primary/5 transition-all">
            <img src={iconImage} className="w-5 h-5" alt="Logo" />
          </div>
          <h1 className="text-base font-black tracking-tight truncate group-data-[collapsible=icon]:hidden uppercase">
            {t("home.title")}
          </h1>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {/* Marketplace */}
        <SidebarGroup className="py-2">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip={t("marketplace.title")}
                  isActive={location.pathname === "/marketplace"}
                  className="rounded-xl transition-all duration-300 h-11 data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                >
                  <Link
                    to="/marketplace"
                    className="flex items-center gap-3 px-3 w-full"
                  >
                    <IconBuildingStore className="h-5 w-5 stroke-[2.5]" />
                    <span className="font-bold text-sm">
                      {t("marketplace.title")}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* MCP Group */}
        <Collapsible defaultOpen className="group/collapsible-mcp">
          <SidebarGroup className="py-2">
            <SidebarGroupLabel className="px-3 mb-1 group-data-[collapsible=icon]:hidden">
              <CollapsibleTrigger className="flex flex-row items-center w-full text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 hover:text-primary transition-colors">
                MCP
                <ChevronDown className="ml-auto h-3 w-3 transition-transform group-data-[state=open]/collapsible-mcp:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      tooltip={t("sidebar.myServers")}
                      isActive={location.pathname === "/servers"}
                      className="rounded-xl transition-all duration-300 h-11 data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                    >
                      <Link
                        to="/servers"
                        className="flex items-center gap-3 px-3 w-full"
                      >
                        <IconServer className="h-5 w-5 stroke-[2.5]" />
                        <span className="font-bold text-sm">
                          {t("sidebar.myServers")}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  {!isRemoteWorkspace && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        tooltip={t("sidebar.logs")}
                        isActive={location.pathname === "/logs"}
                        className="rounded-xl transition-all duration-300 h-11 data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                      >
                        <Link
                          to="/logs"
                          className="flex items-center gap-3 px-3 w-full"
                        >
                          <IconActivity className="h-5 w-5 stroke-[2.5]" />
                          <span className="font-bold text-sm">
                            {t("sidebar.logs")}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}

                  {!isRemoteWorkspace && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        tooltip={t("sidebar.workflows")}
                        isActive={location.pathname.startsWith("/workflows")}
                        className="rounded-xl transition-all duration-300 h-11 data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                      >
                        <Link
                          to="/workflows"
                          className="flex items-center gap-3 px-3 w-full"
                        >
                          <IconArrowsShuffle className="h-5 w-5 stroke-[2.5]" />
                          <span className="font-bold text-sm">
                            {t("sidebar.workflows")}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Skills Group */}
        {!isRemoteWorkspace && (
          <Collapsible defaultOpen className="group/collapsible-skills">
            <SidebarGroup className="py-2">
              <SidebarGroupLabel className="px-3 mb-1 group-data-[collapsible=icon]:hidden">
                <CollapsibleTrigger className="flex flex-row items-center w-full text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 hover:text-primary transition-colors">
                  {t("skills.title")}
                  <ChevronDown className="ml-auto h-3 w-3 transition-transform group-data-[state=open]/collapsible-skills:rotate-180" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        tooltip={t("sidebar.mySkills")}
                        isActive={location.pathname === "/skills"}
                        className="rounded-xl transition-all duration-300 h-11 data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                      >
                        <Link
                          to="/skills"
                          className="flex items-center gap-3 px-3 w-full"
                        >
                          <IconWand className="h-5 w-5 stroke-[2.5]" />
                          <span className="font-bold text-sm">
                            {t("sidebar.mySkills")}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}

        {/* Client Apps */}
        <SidebarGroup className="py-2">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip={t("sidebar.clientApps")}
                  isActive={
                    location.pathname === "/clients" ||
                    location.pathname === "/skills/agents"
                  }
                  className="rounded-xl transition-all duration-300 h-11 data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                >
                  <Link
                    to="/clients"
                    className="flex items-center gap-3 px-3 w-full"
                  >
                    <IconDeviceDesktop className="h-5 w-5 stroke-[2.5]" />
                    <span className="font-bold text-sm">
                      {t("sidebar.clientApps")}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <SidebarMenu>
          {updateAvailable && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip={t("updateNotification.installNow")}
                className="rounded-xl h-11 bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-all mb-2"
              >
                <Link
                  to="#"
                  onClick={handleInstallUpdate}
                  className="flex items-center gap-3 px-3 w-full"
                >
                  <div className="relative">
                    <IconDownload className="h-5 w-5 stroke-[2.5]" />
                    <span className="absolute w-2 h-2 bg-red-500 rounded-full -top-0.5 -right-0.5 border border-background animate-pulse"></span>
                  </div>
                  <span className="font-bold text-sm group-data-[collapsible=icon]:hidden">
                    {t("updateNotification.title")}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip={t("common.settings")}
              isActive={location.pathname === "/settings"}
              className="rounded-xl transition-all duration-300 h-11 data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
            >
              <Link
                to="/settings"
                className="flex items-center gap-3 px-3 w-full"
              >
                <IconSettings className="h-5 w-5 stroke-[2.5]" />
                <span className="font-bold text-sm group-data-[collapsible=icon]:hidden">
                  {t("common.settings")}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

export default SidebarComponent;
