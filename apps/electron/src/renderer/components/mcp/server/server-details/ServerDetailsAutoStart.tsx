import React from "react";
import { useTranslation } from "react-i18next";
import { PlayCircle } from "lucide-react";
import { Switch, Label } from "@mcp_router/ui";
import { MCPServer } from "@mcp_router/shared";

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
      <div className="flex items-start gap-4 px-1">
        <PlayCircle className="h-5 w-5 text-primary mt-1" />
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="text-base font-bold leading-none">
              {t("serverDetails.autoStart")}
            </h3>
          </div>

          <div className="flex items-center justify-between p-6 rounded-2xl border border-border/40 bg-muted/10 soft-shadow transition-all hover:bg-muted/20">
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
              className="data-[state=checked]:bg-primary"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServerDetailsAutoStart;
