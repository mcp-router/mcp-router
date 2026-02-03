import React from "react";
import { MCPServer } from "@mcp_router/shared";
import { useTranslation } from "react-i18next";
import { Server, Settings, Info } from "lucide-react";
import { Label } from "@mcp_router/ui";
import { Input } from "@mcp_router/ui";
import { ScrollArea } from "@mcp_router/ui";

interface ServerDetailsRemoteProps {
  server: MCPServer;
  isEditing?: boolean;
  editedBearerToken?: string;
  setEditedBearerToken?: (token: string) => void;
}

const ServerDetailsRemote: React.FC<ServerDetailsRemoteProps> = ({
  server,
  isEditing = false,
  editedBearerToken = "",
  setEditedBearerToken,
}) => {
  const { t } = useTranslation();

  if (isEditing) {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <Label
            htmlFor="remote-url"
            className="text-base font-bold flex items-center gap-2 px-1"
          >
            <Server className="h-4 w-4 text-primary" />
            {t("serverDetails.remoteUrl")}
          </Label>
          <Input
            id="remote-url"
            value={server.remoteUrl || ""}
            disabled
            className="h-12 rounded-full px-5 bg-muted/20 border-muted/50 font-mono"
          />
          <p className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-2xl px-4 border border-border/50">
            {t("serverDetails.remoteUrl")}
          </p>
        </div>

        <div className="space-y-3">
          <Label
            htmlFor="bearer-token"
            className="text-base font-bold flex items-center gap-2 px-1"
          >
            <Settings className="h-4 w-4 text-primary" />
            {t("serverDetails.bearerToken")}
          </Label>
          <Input
            id="bearer-token"
            value={editedBearerToken}
            onChange={(e) =>
              setEditedBearerToken && setEditedBearerToken(e.target.value)
            }
            placeholder={t("serverDetails.bearerTokenPlaceholder")}
            className="h-12 rounded-full px-5 bg-muted/20 border-muted/50 focus:bg-muted/30 transition-all font-mono"
          />
          <p className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-2xl px-4 border border-border/50">
            {t("serverDetails.bearerTokenHelp")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-primary">
            {t("serverDetails.remoteUrl")}
          </h3>
        </div>
        <div className="pl-6">
          {server.remoteUrl ? (
            <div className="bg-muted p-3 rounded-md border shadow-sm">
              <ScrollArea className="max-h-[150px]">
                <div className="whitespace-pre-wrap text-sm font-mono text-primary/90 break-all">
                  {server.remoteUrl}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground italic p-2">
              <Info className="h-4 w-4" />
              <span>{t("serverDetails.notConfigured")}</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-primary">
            {t("serverDetails.bearerToken")}
          </h3>
        </div>
        <div className="pl-6">
          {server.bearerToken ? (
            <div className="bg-muted p-3 rounded-md border shadow-sm">
              <ScrollArea className="max-h-[150px]">
                <div className="whitespace-pre-wrap text-sm font-mono text-primary/90 break-all">
                  {server.bearerToken}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground italic p-2">
              <Info className="h-4 w-4" />
              <span>{t("serverDetails.notConfigured")}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServerDetailsRemote;
