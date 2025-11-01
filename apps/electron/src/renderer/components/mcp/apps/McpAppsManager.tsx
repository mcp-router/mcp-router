import React, { useEffect, useState, useRef } from "react";
import { Button } from "@mcp_router/ui";
import { usePlatformAPI } from "@/renderer/platform-api";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@mcp_router/ui";
import { Badge } from "@mcp_router/ui";
import { useTranslation } from "react-i18next";
import { Input } from "@mcp_router/ui";
import { Checkbox } from "@mcp_router/ui";
import { Label } from "@mcp_router/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@mcp_router/ui";
import HowToUse, { HowToUseHandle } from "./HowToUse";
import { toast } from "sonner";
import { ScrollArea, ScrollBar } from "@mcp_router/ui";

import { McpApp, McpAppsManagerResult } from "@mcp_router/shared";

const McpAppsManager: React.FC = () => {
  const { t } = useTranslation();
  const platformAPI = usePlatformAPI();
  const [apps, setApps] = useState<McpApp[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [customAppName, setCustomAppName] = useState<string>("");
  const [servers, setServers] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState<McpApp | null>(null);
  const [selectedServerIds, setSelectedServerIds] = useState<string[]>([]);
  const [isAccessControlDialogOpen, setIsAccessControlDialogOpen] =
    useState<boolean>(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [appToDelete, setAppToDelete] = useState<McpApp | null>(null);

  // Add ref for HowToUse component
  const howToUseRef = useRef<HowToUseHandle>(null);

  useEffect(() => {
    loadApps();
    loadServers();
  }, []);

  // アクセス制御ダイアログを開く
  const openAccessControlDialog = (app: McpApp) => {
    setSelectedApp(app);

    // アプリのサーバIDsを設定
    const appServerIds = app.serverIds || [];
    setSelectedServerIds(appServerIds);

    setIsAccessControlDialogOpen(true);
  };

  // サーバーチェックボックスの変更
  const handleServerCheckboxChange = (serverId: string, checked: boolean) => {
    if (checked) {
      setSelectedServerIds((prev) => [...prev, serverId]);
    } else {
      setSelectedServerIds((prev) => prev.filter((id) => id !== serverId));
    }
  };

  // アクセス設定の保存
  const saveAccessControl = async () => {
    if (!selectedApp) return;

    try {
      // サーバーアクセスの更新
      const serverResult = await platformAPI.apps.updateServerAccess(
        selectedApp.name,
        selectedServerIds,
      );

      if (!serverResult.success) {
        toast.error(serverResult.message);
        return;
      }

      // サーバー結果を更新
      if (serverResult.app) {
        setApps((prevApps) =>
          prevApps.map((app) =>
            app.name === selectedApp.name
              ? { ...serverResult.app!, isCustom: app.isCustom }
              : app,
          ),
        );
      }

      toast.success(t("mcpApps.accessControlSaved"));
    } catch (error: any) {
      console.error(
        `Failed to update access control for ${selectedApp.name}:`,
        error,
      );
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsAccessControlDialogOpen(false);
    }
  };

  // サーバ一覧の読み込み
  const loadServers = async () => {
    try {
      const serverList = await platformAPI.servers.list();
      setServers(serverList);
    } catch (error) {
      console.error("Failed to load MCP servers:", error);
    }
  };

  const loadApps = async () => {
    setLoading(true);
    try {
      const appsList = await platformAPI.apps.list();
      setApps(appsList);
    } catch (error) {
      console.error("Failed to load MCP apps:", error);
      toast.error("Error loading apps");
    } finally {
      setLoading(false);
    }
  };

  // カスタムアプリの追加処理
  const handleAddCustomApp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customAppName.trim()) {
      toast.error(t("mcpApps.enterValidName"));
      return;
    }

    try {
      const result = await platformAPI.apps.create(customAppName);

      if (result.success && result.app) {
        // アプリリストに追加
        setApps((prevApps) => [...prevApps, result.app!]);
        toast.success(result.message);
        setCustomAppName(""); // 入力欄をクリア
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      console.error("Failed to add custom app:", error);
      toast.error(`Error: ${error.message}`);
    }
  };

  const handleAddConfig = async (appName: string) => {
    try {
      const result: McpAppsManagerResult =
        await platformAPI.apps.create(appName);

      if (result.success && result.app) {
        // Update the app in the list
        setApps((prevApps) =>
          prevApps.map((app) => (app.name === appName ? result.app! : app)),
        );
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      console.error(`Failed to add MCP config to ${appName}:`, error);
      toast.error(
        `Error adding MCP configuration to ${appName}: ${error.message}`,
      );
    }
  };

  const getStatusBadge = (app: McpApp) => {
    if (!app.installed) {
      return <Badge variant="outline">{t("mcpApps.notInstalled")}</Badge>;
    }
    if (app.hasOtherServers) {
      return (
        <Badge variant="destructive">{t("mcpApps.multipleConfigs")}</Badge>
      );
    }
    return <Badge variant="secondary">{t("mcpApps.installed")}</Badge>;
  };

  // アプリの設定を統一（他のMCPサーバ設定を削除）
  const handleUnifyConfig = async (appName: string) => {
    try {
      const result: McpAppsManagerResult =
        await platformAPI.apps.unifyConfig(appName);

      if (result.success && result.app) {
        // アプリリストを更新
        setApps((prevApps) =>
          prevApps.map((app) => (app.name === appName ? result.app! : app)),
        );
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      console.error(`Failed to unify config for ${appName}:`, error);
      toast.error(
        `Error unifying configuration for ${appName}: ${error.message}`,
      );
    }
  };

  // Function to open HowToUse modal with the token from the selected app
  const openHowToUseModal = (app: McpApp) => {
    setSelectedApp(app);
    if (howToUseRef.current) {
      howToUseRef.current.showDialog();
    }
  };

  // カスタムアプリ削除ダイアログを開く
  const openDeleteDialog = (app: McpApp) => {
    setAppToDelete(app);
    setIsDeleteDialogOpen(true);
  };

  // カスタムアプリ削除実行
  const handleDeleteApp = async () => {
    if (!appToDelete) return;

    try {
      const success = await platformAPI.apps.delete(appToDelete.name);

      if (success) {
        // アプリリストから削除
        setApps((prevApps) =>
          prevApps.filter((app) => app.name !== appToDelete.name),
        );
        toast.success(t("mcpApps.deleteSuccess"));
      } else {
        toast.error(t("mcpApps.deleteFailed"));
      }
    } catch (error: any) {
      console.error(`Failed to delete app ${appToDelete.name}:`, error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsDeleteDialogOpen(false);
      setAppToDelete(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">{t("mcpApps.title")}</h2>
        <p className="text-muted-foreground">{t("mcpApps.description")}</p>
      </div>

      {/* カスタムアプリ追加フォーム */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>{t("mcpApps.addCustomApp")}</CardTitle>
          <CardDescription>{t("mcpApps.customAppDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddCustomApp} className="flex gap-4 items-end">
            <div className="flex-1">
              <Input
                id="customAppName"
                value={customAppName}
                onChange={(e) => setCustomAppName(e.target.value)}
                placeholder={t("mcpApps.enterAppName")}
              />
            </div>
            <Button type="submit">{t("mcpApps.addCustomApp")}</Button>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <></>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
          {apps.map((app) => {
            return (
              <Card key={app.name} className="overflow-hidden">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      {/* Display icon if available from backend */}
                      {app.icon && (
                        <div
                          className="w-6 h-6 flex items-center justify-center"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          dangerouslySetInnerHTML={{
                            __html: app.icon.replace(
                              /<svg/g,
                              '<svg style="width: 100%; height: 100%; max-width: 24px; max-height: 24px;"',
                            ),
                          }}
                        />
                      )}
                      <CardTitle className="truncate max-w-[150px]">
                        {app.name}
                      </CardTitle>
                    </div>
                    <div className="flex gap-2">{getStatusBadge(app)}</div>
                  </div>
                  <CardDescription></CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm break-words">
                      {app.configured
                        ? t("mcpApps.configured")
                        : app.installed
                          ? t("mcpApps.notConfigured")
                          : t("mcpApps.installRequired")}
                    </p>
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2 justify-between flex-wrap">
                  <div>
                    {/* Add How To Use and Delete buttons to the left of the card footer */}
                    <div className="flex gap-2 flex-wrap">
                      {app.isCustom && app.configured && app.token && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openHowToUseModal(app)}
                        >
                          {t("mcpApps.howToUse")}
                        </Button>
                      )}
                      {app.isCustom && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => openDeleteDialog(app)}
                        >
                          {t("mcpApps.delete")}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div>
                    {!app.configured ? (
                      <Button
                        onClick={() => handleAddConfig(app.name)}
                        variant="default"
                      >
                        {app.installed
                          ? t("mcpApps.addMcpConfig")
                          : t("mcpApps.notAvailable")}
                      </Button>
                    ) : (
                      <div className="flex gap-2 flex-wrap">
                        {app.hasOtherServers && (
                          <Button
                            onClick={() => handleUnifyConfig(app.name)}
                            variant="default"
                            size="sm"
                          >
                            {t("mcpApps.unify")}
                          </Button>
                        )}
                        <Button
                          onClick={() => openAccessControlDialog(app)}
                          variant="outline"
                          size="sm"
                        >
                          {t("mcpApps.serverAccess")}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* アクセス制御ダイアログ（サーバーアクセスとトークンスコープを統合） */}
      <Dialog
        open={isAccessControlDialogOpen}
        onOpenChange={setIsAccessControlDialogOpen}
      >
        <DialogContent className="max-w-md overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {t("mcpApps.serverAccess")} - {selectedApp?.name}
            </DialogTitle>
          </DialogHeader>

          {/* Replaced Tabs with direct content */}
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              {t("mcpApps.selectServers")}
            </p>
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-2 pr-2">
                {servers.map((server) => (
                  <div key={server.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={`server-${server.id}`}
                      checked={selectedServerIds.includes(server.id)}
                      onCheckedChange={(checked) =>
                        handleServerCheckboxChange(server.id, !!checked)
                      }
                    />
                    <Label htmlFor={`server-${server.id}`}>{server.name}</Label>
                  </div>
                ))}
              </div>
              <ScrollBar orientation="vertical" />
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setIsAccessControlDialogOpen(false)}
              variant="outline"
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={saveAccessControl}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("mcpApps.confirmDelete")} - {appToDelete?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              {t("mcpApps.deleteWarning")}
            </p>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setIsDeleteDialogOpen(false)}
              variant="outline"
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={handleDeleteApp} variant="destructive">
              {t("mcpApps.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="hidden">
        <HowToUse ref={howToUseRef} token={selectedApp?.token} />
      </div>
    </div>
  );
};

export default McpAppsManager;
