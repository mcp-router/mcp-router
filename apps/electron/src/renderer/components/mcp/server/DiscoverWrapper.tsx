import React from "react";
import { useTranslation } from "react-i18next";
import Manual from "./Manual";
import { useWorkspaceStore } from "@/renderer/stores";

const DiscoverWrapper: React.FC = () => {
  const { t } = useTranslation();
  const { currentWorkspace } = useWorkspaceStore();

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold mb-4 text-center">
        {t("discoverServers.title")}
      </h2>
      <Manual />
    </div>
  );
};

export default DiscoverWrapper;
