import React from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@mcp_router/ui";
import { Badge } from "@mcp_router/ui";
import { Button } from "@mcp_router/ui";
import { IconCheck, IconX } from "@tabler/icons-react";
import type { ClientApp } from "@mcp_router/shared";

interface ClientAppCardProps {
  clientApp: ClientApp;
  onServerAccess: () => void;
  onHowToUse: () => void;
  onConfigure: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const ClientAppCard: React.FC<ClientAppCardProps> = ({
  clientApp,
  onServerAccess,
  onHowToUse,
  onConfigure,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation();

  const getStatusBadge = () => {
    if (clientApp.isCustom) {
      return <Badge variant="default">{t("clientApps.custom")}</Badge>;
    }
    if (!clientApp.installed) {
      return <Badge variant="outline">{t("clientApps.notInstalled")}</Badge>;
    }
    return <Badge variant="secondary">{t("clientApps.installed")}</Badge>;
  };

  const isConfigured = clientApp.mcpConfigured || clientApp.skillsConfigured;

  return (
    <Card className="overflow-hidden rounded-2xl border-border/40 soft-shadow">
      <CardHeader className="p-6 pb-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            {clientApp.icon && (
              <div
                className="w-8 h-8 flex items-center justify-center p-1.5 bg-muted/30 rounded-xl"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                dangerouslySetInnerHTML={{
                  __html: clientApp.icon.replace(
                    /<svg/g,
                    '<svg style="width: 100%; height: 100%;"',
                  ),
                }}
              />
            )}
            <CardTitle className="truncate max-w-[150px] text-lg">
              {clientApp.name}
            </CardTitle>
          </div>
          <div className="flex gap-2">{getStatusBadge()}</div>
        </div>
      </CardHeader>

      <CardContent className="p-6 pt-0">
        <div className="space-y-3">
          {/* MCP Status */}
          <div className="flex items-center gap-3 text-sm">
            {clientApp.mcpConfigured ? (
              <IconCheck size={18} className="text-emerald-500 shrink-0" />
            ) : (
              <IconX size={18} className="text-destructive shrink-0" />
            )}
            <span className="font-medium">
              {clientApp.mcpConfigured
                ? t("clientApps.mcpConfigured")
                : t("clientApps.mcpNotConfigured")}
            </span>
          </div>

          {/* Skills Status */}
          <div className="flex items-center gap-3 text-sm">
            {clientApp.skillsConfigured ? (
              <IconCheck size={18} className="text-emerald-500 shrink-0" />
            ) : (
              <IconX size={18} className="text-destructive shrink-0" />
            )}
            <span className="font-medium">
              {clientApp.skillsConfigured
                ? t("clientApps.skillsSynced")
                : t("clientApps.skillsNotSetUp")}
            </span>
          </div>

          {/* Show paths for custom clients */}
          {clientApp.isCustom && (
            <div className="mt-4 p-3 rounded-xl bg-muted/20 border border-border/40 space-y-2 text-xs text-muted-foreground">
              {clientApp.mcpConfigPath && (
                <div className="truncate" title={clientApp.mcpConfigPath}>
                  <span className="font-semibold text-primary/80">
                    {t("clientApps.addCustomClient.mcpConfigPath")}:
                  </span>{" "}
                  {clientApp.mcpConfigPath}
                </div>
              )}
              {clientApp.skillsPath && (
                <div className="truncate" title={clientApp.skillsPath}>
                  <span className="font-semibold text-primary/80">
                    {t("clientApps.addCustomClient.skillsPath")}:
                  </span>{" "}
                  {clientApp.skillsPath}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-6 pt-2 flex gap-3 justify-between flex-wrap border-t border-border/40 bg-muted/5">
        <div className="flex gap-2 flex-wrap">
          {isConfigured && clientApp.token && (
            <Button
              variant="outline"
              size="sm"
              onClick={onHowToUse}
              className="rounded-full px-4"
            >
              {t("clientApps.howToUse")}
            </Button>
          )}
          {clientApp.isCustom && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
              className="rounded-full px-4"
            >
              {t("clientApps.delete")}
            </Button>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {!isConfigured ? (
            <Button
              onClick={onConfigure}
              variant="default"
              disabled={!clientApp.installed}
              className="rounded-full px-6"
            >
              {t("clientApps.configure")}
            </Button>
          ) : (
            <>
              {clientApp.isCustom && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onEdit}
                  className="rounded-full px-4"
                >
                  {t("clientApps.edit")}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={onServerAccess}
                className="rounded-full px-4"
              >
                {t("clientApps.serverAccess")}
              </Button>
            </>
          )}
        </div>
      </CardFooter>
    </Card>
  );
};

export default ClientAppCard;
