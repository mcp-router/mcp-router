import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@mcp_router/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@mcp_router/ui";
import { Button } from "@mcp_router/ui";
import { Switch } from "@mcp_router/ui";
import { Input } from "@mcp_router/ui";
import { Textarea } from "@mcp_router/ui";
import { toast } from "sonner";
import { useThemeStore } from "@/renderer/stores";
import { useAuthStore } from "../../stores";
import {
  IconBrandDiscord,
  IconCloud,
  IconLock,
  IconUser,
} from "@tabler/icons-react";
import { electronPlatformAPI as platformAPI } from "../../platform-api/electron-platform-api";
import { postHogService } from "../../services/posthog-service";
import type { CloudSyncStatus } from "@mcp_router/shared";

const Settings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [isRefreshingSubscription, setIsRefreshingSubscription] =
    useState(false);
  const [loadExternalMCPConfigs, setLoadExternalMCPConfigs] =
    useState<boolean>(true);
  const [analyticsEnabled, setAnalyticsEnabled] = useState<boolean>(true);
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState<boolean>(true);
  const [showWindowOnStartup, setShowWindowOnStartup] = useState<boolean>(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Cloud Sync state
  const [cloudSyncStatus, setCloudSyncStatus] =
    useState<CloudSyncStatus | null>(null);
  const [isLoadingCloudSync, setIsLoadingCloudSync] = useState(false);
  const [cloudSyncPassphrase, setCloudSyncPassphrase] = useState("");
  const [isSettingPassphrase, setIsSettingPassphrase] = useState(false);

  // Feedback state
  const [feedback, setFeedback] = useState("");
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);

  // Zustand stores
  const { theme, setTheme } = useThemeStore();
  const {
    isAuthenticated,
    userInfo,
    isLoggingIn,
    login,
    logout,
    checkAuthStatus,
    subscribeToAuthChanges,
  } = useAuthStore();

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
  };

  // Get normalized language code for select
  const getCurrentLanguage = () => {
    const currentLang = i18n.language;
    if (currentLang.startsWith("en")) return "en";
    if (currentLang.startsWith("ja")) return "ja";
    if (currentLang.startsWith("zh")) return "zh";
    return "en";
  };

  // 認証状態の監視
  useEffect(() => {
    checkAuthStatus();
    const unsubscribe = subscribeToAuthChanges();
    return () => {
      unsubscribe();
    };
  }, [checkAuthStatus, subscribeToAuthChanges]);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await platformAPI.settings.get();
        setLoadExternalMCPConfigs(settings.loadExternalMCPConfigs ?? true);
        setAnalyticsEnabled(settings.analyticsEnabled ?? true);
        setAutoUpdateEnabled(settings.autoUpdateEnabled ?? true);
        setShowWindowOnStartup(settings.showWindowOnStartup ?? true);
      } catch {
        console.log("Failed to load settings, using defaults");
      }
    };
    loadSettings();
  }, []);

  // Load Cloud Sync status
  useEffect(() => {
    const loadCloudSyncStatus = async () => {
      try {
        setIsLoadingCloudSync(true);
        const status = await platformAPI.cloudSync.getStatus();
        setCloudSyncStatus(status);
      } catch (error) {
        console.error("Failed to load cloud sync status:", error);
      } finally {
        setIsLoadingCloudSync(false);
      }
    };
    loadCloudSyncStatus();
  }, []);

  // Settingsページ表示時にサブスクリプション情報を更新
  useEffect(() => {
    if (isAuthenticated) {
      const refreshSubscriptionInfo = async () => {
        await checkAuthStatus(true);
      };
      refreshSubscriptionInfo();
    }
  }, [isAuthenticated, checkAuthStatus]);

  // ログイン処理
  const handleLogin = async () => {
    try {
      await login();
    } catch (error) {
      console.error("ログインに失敗しました:", error);
    }
  };

  // ログアウト処理
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("ログアウトに失敗しました:", error);
    }
  };

  // サブスクリプション情報の更新処理
  const handleRefreshSubscription = async () => {
    if (!isAuthenticated || isRefreshingSubscription) return;
    try {
      setIsRefreshingSubscription(true);
      await checkAuthStatus(true);
    } catch (error) {
      console.error("サブスクリプション情報の更新に失敗しました:", error);
    } finally {
      setIsRefreshingSubscription(false);
    }
  };

  // Handle external MCP configs toggle
  const handleExternalMCPConfigsToggle = async (checked: boolean) => {
    setLoadExternalMCPConfigs(checked);
    setIsSavingSettings(true);
    try {
      const currentSettings = await platformAPI.settings.get();
      await platformAPI.settings.save({
        ...currentSettings,
        loadExternalMCPConfigs: checked,
      });
    } catch (error) {
      console.error("Failed to save settings:", error);
      setLoadExternalMCPConfigs(!checked);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Handle analytics toggle
  const handleAnalyticsToggle = async (checked: boolean) => {
    setAnalyticsEnabled(checked);
    setIsSavingSettings(true);
    try {
      const currentSettings = await platformAPI.settings.get();
      await platformAPI.settings.save({
        ...currentSettings,
        analyticsEnabled: checked,
      });
      postHogService.updateConfig({
        analyticsEnabled: checked,
        userId: currentSettings.userId,
      });
    } catch (error) {
      console.error("Failed to save analytics settings:", error);
      setAnalyticsEnabled(!checked);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Handle auto update toggle
  const handleAutoUpdateToggle = async (checked: boolean) => {
    setAutoUpdateEnabled(checked);
    setIsSavingSettings(true);
    try {
      const currentSettings = await platformAPI.settings.get();
      await platformAPI.settings.save({
        ...currentSettings,
        autoUpdateEnabled: checked,
      });
    } catch (error) {
      console.error("Failed to save auto update settings:", error);
      setAutoUpdateEnabled(!checked);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Handle startup visibility toggle
  const handleStartupVisibilityToggle = async (checked: boolean) => {
    setShowWindowOnStartup(checked);
    setIsSavingSettings(true);
    try {
      const currentSettings = await platformAPI.settings.get();
      await platformAPI.settings.save({
        ...currentSettings,
        showWindowOnStartup: checked,
      });
    } catch (error) {
      console.error("Failed to save startup visibility settings:", error);
      setShowWindowOnStartup(!checked);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Cloud Sync handlers
  const handleCloudSyncToggle = async (checked: boolean) => {
    if (!cloudSyncStatus) return;
    try {
      const newStatus = await platformAPI.cloudSync.setEnabled(checked);
      setCloudSyncStatus(newStatus);
    } catch (error) {
      console.error("Failed to toggle cloud sync:", error);
    }
  };

  const handleSetPassphraseAndEnable = async () => {
    if (!cloudSyncPassphrase.trim()) return;
    try {
      setIsSettingPassphrase(true);
      await platformAPI.cloudSync.setPassphrase(cloudSyncPassphrase);
      // パスフレーズ設定後、自動でCloud Syncを有効化
      const newStatus = await platformAPI.cloudSync.setEnabled(true);
      setCloudSyncStatus(newStatus);
      setCloudSyncPassphrase("");
    } catch (error) {
      console.error("Failed to set passphrase:", error);
    } finally {
      setIsSettingPassphrase(false);
    }
  };

  // Feedback handler
  const handleSubmitFeedback = async () => {
    if (!feedback.trim()) return;
    setIsSendingFeedback(true);
    try {
      const success = await platformAPI.settings.submitFeedback(
        feedback.trim(),
      );
      if (success) {
        setFeedback("");
        toast.success(t("feedback.sent"));
      } else {
        toast.error(t("feedback.failed"));
      }
    } catch {
      toast.error(t("feedback.failed"));
    } finally {
      setIsSendingFeedback(false);
    }
  };

  const isSubscribed =
    userInfo?.subscriptionStatus && userInfo.subscriptionStatus !== "canceled";

  const planNameLabel =
    userInfo?.planName && userInfo.planName.trim().length > 0
      ? userInfo.planName
      : t("settings.planNameUnknown");

  return (
    <div className="p-6 flex flex-col gap-6">
      <h1 className="text-3xl font-bold">{t("common.settings")}</h1>

      {/* Account & Plan Hero Card */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <IconUser className="h-5 w-5" />
            {t("settings.accountAndPlan")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* User Info & Plan Section */}
          {isAuthenticated ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold">
                  {userInfo?.name || userInfo?.userId}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {isSubscribed ? (
                    <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                      {planNameLabel}
                    </span>
                  ) : (
                    <>
                      <span className="text-sm text-muted-foreground">
                        Free
                      </span>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-sm"
                        onClick={() =>
                          window.open(
                            "https://mcp-router.net/en/profile",
                            "_blank",
                          )
                        }
                      >
                        {t("settings.getPro")} →
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                disabled={isLoggingIn}
              >
                {isLoggingIn ? t("settings.loggingOut") : t("settings.logout")}
              </Button>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800">
              <p className="text-sm text-muted-foreground mb-3">
                {t("settings.loginOptionalDescription")}
              </p>
              <Button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="w-full"
              >
                {isLoggingIn ? t("settings.loggingIn") : t("settings.login")}
              </Button>
            </div>
          )}

          {/* Pro Features Section */}
          {isAuthenticated && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold">
                  Pro
                </span>
                {t("settings.proFeatures")}
              </div>

              {/* Cloud Sync */}
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <IconCloud className="h-5 w-5 text-purple-500" />
                    <div>
                      <p className="font-medium">{t("settings.cloudSync")}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("settings.cloudSyncDescription")}
                      </p>
                    </div>
                  </div>
                  {/* Pro限定バッジ or トグル（パスフレーズ設定済みの場合のみ） */}
                  {!isSubscribed ? (
                    <span className="text-xs px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-muted-foreground">
                      {t("settings.proOnly")}
                    </span>
                  ) : (
                    cloudSyncStatus?.hasPassphrase && (
                      <Switch
                        checked={cloudSyncStatus?.enabled ?? false}
                        onCheckedChange={handleCloudSyncToggle}
                        disabled={
                          isLoadingCloudSync ||
                          !cloudSyncStatus?.encryptionAvailable
                        }
                      />
                    )
                  )}
                </div>

                {/* Pro users: State-based UI */}
                {isSubscribed && cloudSyncStatus && (
                  <>
                    {cloudSyncStatus.hasPassphrase ? (
                      /* パスフレーズ設定済み: ステータス表示 */
                      <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
                        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                          <IconLock className="h-4 w-4" />
                          {t("settings.passphraseSet")}
                        </div>
                        {cloudSyncStatus.enabled &&
                          cloudSyncStatus.lastSyncedAt && (
                            <p className="text-xs text-muted-foreground">
                              {t("settings.lastSynced")}:{" "}
                              {new Date(
                                cloudSyncStatus.lastSyncedAt,
                              ).toLocaleString()}
                            </p>
                          )}
                        {cloudSyncStatus.lastError && (
                          <p className="text-xs text-red-500">
                            {cloudSyncStatus.lastError}
                          </p>
                        )}
                      </div>
                    ) : (
                      /* パスフレーズ未設定: 入力欄 + 有効化ボタン */
                      <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-3">
                        <p className="text-sm text-muted-foreground">
                          {t("settings.setPassphraseDescription")}
                        </p>
                        <div className="flex gap-2">
                          <Input
                            type="password"
                            placeholder={t("settings.passphrasePlaceholder")}
                            value={cloudSyncPassphrase}
                            onChange={(e) =>
                              setCloudSyncPassphrase(e.target.value)
                            }
                            className="flex-1"
                          />
                          <Button
                            size="sm"
                            onClick={handleSetPassphraseAndEnable}
                            disabled={
                              isSettingPassphrase || !cloudSyncPassphrase.trim()
                            }
                          >
                            {isSettingPassphrase
                              ? t("common.saving")
                              : t("settings.enableCloudSync")}
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preferences Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t("settings.preferences")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Language */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">
                {t("common.language")}
              </label>
            </div>
            <Select
              value={getCurrentLanguage()}
              onValueChange={handleLanguageChange}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("common.language")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="zh">中文</SelectItem>
                <SelectItem value="ja">日本語</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Theme */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">
                {t("settings.theme")}
              </label>
            </div>
            <Select
              value={theme}
              onValueChange={(value: "light" | "dark" | "system") =>
                setTheme(value)
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("settings.theme")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  {t("settings.themeLight")}
                </SelectItem>
                <SelectItem value="dark">{t("settings.themeDark")}</SelectItem>
                <SelectItem value="system">
                  {t("settings.themeSystem")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Auto Update */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">
                {t("settings.autoUpdate")}
              </label>
              <p className="text-xs text-muted-foreground">
                {t("settings.autoUpdateDescription")}
              </p>
            </div>
            <Switch
              checked={autoUpdateEnabled}
              onCheckedChange={handleAutoUpdateToggle}
              disabled={isSavingSettings}
            />
          </div>

          {/* Show Window on Startup */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">
                {t("settings.showWindowOnStartup")}
              </label>
              <p className="text-xs text-muted-foreground">
                {t("settings.showWindowOnStartupDescription")}
              </p>
            </div>
            <Switch
              checked={showWindowOnStartup}
              onCheckedChange={handleStartupVisibilityToggle}
              disabled={isSavingSettings}
            />
          </div>

          {/* Load External MCP Configs */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">
                {t("settings.loadExternalMCPConfigs")}
              </label>
              <p className="text-xs text-muted-foreground">
                {t("settings.loadExternalMCPConfigsDescription")}
              </p>
            </div>
            <Switch
              checked={loadExternalMCPConfigs}
              onCheckedChange={handleExternalMCPConfigsToggle}
              disabled={isSavingSettings}
            />
          </div>

          {/* Analytics */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">
                {t("settings.analytics")}
              </label>
              <p className="text-xs text-muted-foreground">
                {t("settings.analyticsDescription")}
              </p>
            </div>
            <Switch
              checked={analyticsEnabled}
              onCheckedChange={handleAnalyticsToggle}
              disabled={isSavingSettings}
            />
          </div>
        </CardContent>
      </Card>

      {/* Community & Feedback Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t("settings.community")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Discord */}
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("settings.communityDescription")}
            </p>
            <Button
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
              onClick={() =>
                window.open("https://discord.gg/dwG9jPrhxB", "_blank")
              }
            >
              <IconBrandDiscord className="h-5 w-5" />
              {t("settings.joinDiscord")}
            </Button>
          </div>

          {/* Feedback */}
          <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <p className="text-sm text-muted-foreground">
              {t("settings.feedbackDescription")}
            </p>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
              placeholder={t("feedback.placeholder")}
              className="text-sm"
            />
            <Button
              onClick={handleSubmitFeedback}
              disabled={!feedback.trim() || isSendingFeedback}
              className="w-full"
            >
              {isSendingFeedback ? t("common.loading") : t("common.send")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
