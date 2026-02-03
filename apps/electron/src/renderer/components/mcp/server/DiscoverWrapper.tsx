import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@mcp_router/ui";
import Manual from "./Manual";

const DiscoverWrapper: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* Breadcrumbs: Servers > Add */}
      <Breadcrumb className="px-1">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/servers">{t("serverList.title")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t("discoverServers.title")}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-2xl soft-shadow overflow-hidden">
        <div className="p-8 border-b border-border/40 bg-card/50">
          <h1 className="text-3xl font-extrabold tracking-tight">
            {t("discoverServers.title")}
          </h1>
          <p className="text-muted-foreground mt-2">
            Add a new MCP server to your router using one of the methods below.
          </p>
        </div>
        <Manual />
      </div>
    </div>
  );
};

export default DiscoverWrapper;
