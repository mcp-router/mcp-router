import React, { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@mcp_router/ui";

// Import actual components
import { McpServerGrid } from "./mcp-servers";
import { SkillsGrid } from "./skills";
import { MarketplaceSearch } from "./shared";

type MarketplaceTab = "servers" | "skills";

const Marketplace: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get active tab from URL, default to "servers"
  const activeTab = (searchParams.get("tab") as MarketplaceTab) || "servers";
  const searchQuery = searchParams.get("q") || "";

  // Handle tab change - update URL
  const handleTabChange = useCallback(
    (value: string) => {
      const newParams = new URLSearchParams(searchParams);
      newParams.set("tab", value);
      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  // Handle search query change - update URL
  const handleSearchChange = useCallback(
    (value: string) => {
      const newParams = new URLSearchParams(searchParams);
      if (value) {
        newParams.set("q", value);
      } else {
        newParams.delete("q");
      }
      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  return (
    <div className="flex flex-col h-full bg-card rounded-2xl soft-shadow overflow-hidden border">
      {/* Header */}
      <div className="flex justify-between items-center p-6 border-b bg-card/50 backdrop-blur-sm">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {t("marketplace.title")}
        </h1>
        <MarketplaceSearch
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder={t("marketplace.searchPlaceholder")}
        />
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <div className="px-6 pt-6">
          <TabsList className="bg-muted/50 p-1 rounded-full">
            <TabsTrigger
              value="servers"
              className="rounded-full px-6 transition-all"
            >
              {t("marketplace.tabs.servers")}
            </TabsTrigger>
            <TabsTrigger
              value="skills"
              className="rounded-full px-6 transition-all"
            >
              {t("marketplace.tabs.skills")}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Content Area */}
        <TabsContent
          value="servers"
          className="flex-1 overflow-auto p-6 focus-visible:outline-none"
        >
          <McpServerGrid searchQuery={searchQuery} />
        </TabsContent>

        <TabsContent
          value="skills"
          className="flex-1 overflow-auto p-6 focus-visible:outline-none"
        >
          <SkillsGrid searchQuery={searchQuery} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Marketplace;
