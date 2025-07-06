import React from "react";
import { useTranslation } from "react-i18next";
import { PlayCircle } from "lucide-react";
import { Switch, Label } from "@mcp-router/ui";
import { MCPServer } from "../../../../../types";

interface ServerDetailsAutoStartProps {
  server: MCPServer;
  isEditing: boolean;
  editedAutoStart: boolean;
  setEditedAutoStart?: (autoStart: boolean) => void;
}

const ServerDetailsAutoStart: React.FC<ServerDetailsAutoStartProps> = ({
  server,
  isEditing,
  editedAutoStart,
  setEditedAutoStart,
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <PlayCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="text-sm font-medium leading-none">
              {t("serverDetails.autoStart")}
            </h3>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
            <Label
              htmlFor="auto-start"
              className="text-sm font-medium cursor-pointer flex-1"
            >
              {t("serverDetails.autoStartToggleLabel")}
            </Label>
            <Switch
              id="auto-start"
              checked={isEditing ? editedAutoStart : server.autoStart || false}
              onCheckedChange={isEditing ? setEditedAutoStart : undefined}
              disabled={!isEditing}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServerDetailsAutoStart;
