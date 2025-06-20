import React from "react";
import { IconSearch } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

interface ServerSearchBoxProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  placeholderKey?: string;
}

const ServerSearchBox: React.FC<ServerSearchBoxProps> = ({
  searchTerm,
  onSearchChange,
  placeholderKey = "discoverServers.searchPlaceholder",
}) => {
  const { t } = useTranslation();

  return (
    <div className="mb-4 relative">
      <div className="relative">
        <input
          type="text"
          placeholder={t(placeholderKey)}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
      </div>
    </div>
  );
};

export default ServerSearchBox;
