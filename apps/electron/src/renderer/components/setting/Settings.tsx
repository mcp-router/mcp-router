import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@mcp_router/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@mcp_router/ui";
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
import { Loader2 } from "lucide-react";
import { electronPlatformAPI as platformAPI } from "../../platform-api/electron-platform-api";
import { postHogService } from "../../services/posthog-service";
import type { CloudSyncStatus, AppSettings } from "@mcp_router/shared";

/**
 * Helper function to generate toggle handlers for boolean settings.
 * Manages optimistic update, save, rollback on error, and loading state.
 */
type BooleanSettingKey = {
  [K in keyof AppSettings]: AppSettings[K] extends boolean | undefined
    ? K
    : never;
}[keyof AppSettings];

interface CreateBooleanSettingToggleOptions {
  /** Setting key */
  settingKey: BooleanSettingKey;
  /** Local state setter */
  stateSetter: React.Dispatch<React.SetStateAction<boolean>>;
  /** Loading state setter */
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  /** Additional processing to run after a successful save */
  onSuccess?: (checked: boolean, currentSettings: AppSettings) => void;
}

const createBooleanSettingToggle = ({
  settingKey,
  stateSetter,
  setLoading,
  onSuccess,
}: CreateBooleanSettingToggleOptions) => {
  return async (checked: boolean) => {
    stateSetter(checked);
    setLoading(true);
    try {
      const currentSettings = await platformAPI.settings.get();
      const updatedSettings: AppSettings = {
        ...currentSettings,
        [settingKey as string]: checked,
      };
      await platformAPI.settings.save(updatedSettings);
      onSuccess?.(checked, currentSettings);
    } catch (error) {
      console.error(`Failed to save ${settingKey} settings:`, error);
      stateSetter(!checked);
    } finally {
      setLoading(false);
    }
  };
};

const Settings: React.FC = () => {
  const { t } = useTranslation();
  const [isRefreshingSubscription, setIsRefreshingSubscription] =
    useState(false);
  const [loadExternalMCPConfigs, setLoadExternalMCPConfigs] =
    useState<boolean>(true);
  const [analyticsEnabled, setAnalyticsEnabled] = useState<boolean>(true);
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState<boolean>(true);
  const [showWindowOnStartup, setShowWindowOnStartup] = useState<boolean>(true);
  const [prefixToolNames, setPrefixToolNames] = useState<boolean>(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Cloud Sync state
  const [cloudSyncStatus, setCloudSyncStatus] =
    useState<CloudSyncStatus | null>(null);
  const [isLoadingCloudSync, setIsLoadingCloudSync] = useState(false);
  const [cloudSyncPassphrase, setCloudSyncPassphrase] = useState("");
  const [isSettingPassphrase, setIsSettingPassphrase] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

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

  // Monitor authentication state
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
        setPrefixToolNames(settings.prefixToolNames ?? true);
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

  // Refresh subscription info when Settings page is displayed
  useEffect(() => {
    if (isAuthenticated) {
      const refreshSubscriptionInfo = async () => {
        await checkAuthStatus(true);
      };
      refreshSubscriptionInfo();
    }
  }, [isAuthenticated, checkAuthStatus]);

  // Login handler
  const handleLogin = async () => {
    try {
      await login();
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Refresh subscription info
  const _handleRefreshSubscription = async () => {
    if (!isAuthenticated || isRefreshingSubscription) return;

    try {
      setIsRefreshingSubscription(true);
      await checkAuthStatus(true);
    } catch (error) {
      console.error("Failed to refresh subscription info:", error);
    } finally {
      setIsRefreshingSubscription(false);
    }
  };

  // Boolean setting toggle handlers using generic helper
  const handleExternalMCPConfigsToggle = createBooleanSettingToggle({
    settingKey: "loadExternalMCPConfigs",
    stateSetter: setLoadExternalMCPConfigs,
    setLoading: setIsSavingSettings,
  });

  const handleAnalyticsToggle = createBooleanSettingToggle({
    settingKey: "analyticsEnabled",
    stateSetter: setAnalyticsEnabled,
    setLoading: setIsSavingSettings,
    onSuccess: (checked, currentSettings) => {
      postHogService.updateConfig({
        analyticsEnabled: checked,
        userId: currentSettings.userId,
      });
    },
  });

  const handleAutoUpdateToggle = createBooleanSettingToggle({
    settingKey: "autoUpdateEnabled",
    stateSetter: setAutoUpdateEnabled,
    setLoading: setIsSavingSettings,
  });

  const handleStartupVisibilityToggle = createBooleanSettingToggle({
    settingKey: "showWindowOnStartup",
    stateSetter: setShowWindowOnStartup,
    setLoading: setIsSavingSettings,
  });

  const handlePrefixToolNamesToggle = createBooleanSettingToggle({
    settingKey: "prefixToolNames",
    stateSetter: setPrefixToolNames,
    setLoading: setIsSavingSettings,
  });

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
      // Automatically enable Cloud Sync after setting passphrase
      const newStatus = await platformAPI.cloudSync.setEnabled(true);
      setCloudSyncStatus(newStatus);
      setCloudSyncPassphrase("");
    } catch (error) {
      console.error("Failed to set passphrase:", error);
      toast.error(t("settings.passphraseError"));
    } finally {
      setIsSettingPassphrase(false);
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      await platformAPI.cloudSync.syncNow();
      const newStatus = await platformAPI.cloudSync.getStatus();
      setCloudSyncStatus(newStatus);
      toast.success(
        t("settings.syncSuccess", {
          defaultValue: "Sync completed successfully",
        }),
      );
    } catch (error) {
      console.error("Failed to sync:", error);
      toast.error(t("settings.syncError", { defaultValue: "Sync failed" }));
    } finally {
      setIsSyncing(false);
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

  const _subscriptionDisplay = isSubscribed
    ? planNameLabel
    : t("settings.notSubscribed");

  return (
    <div className="p-10 flex flex-col gap-10 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold tracking-tight">
        {t("common.settings")}
      </h1>

      {/* Account & Plan Hero Card */}
      <Card className="border-border/40 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl flex items-center gap-2.5">
            <IconUser className="h-5 w-5 text-primary" />
            {t("settings.accountAndPlan")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* User Info & Plan Section */}
          {isAuthenticated ? (
            <div className="flex items-center justify-between p-1">
              <div>
                <p className="text-xl font-semibold">
                  {userInfo?.name || userInfo?.userId}
                </p>
                <div className="flex items-center gap-2.5 mt-1.5">
                  {isSubscribed ? (
                    <span className="text-sm font-medium text-primary">
                      {planNameLabel}
                    </span>
                  ) : (
                    <>
                      <span className="text-sm text-muted-foreground font-medium">
                        Free
                      </span>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-sm font-semibold text-primary hover:no-underline"
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
                className="rounded-full px-5 border-border/60"
              >
                {isLoggingIn ? t("settings.loggingOut") : t("settings.logout")}
              </Button>
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-secondary/40 border border-border/40">
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                {t("settings.loginOptionalDescription")}
              </p>
              <Button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="w-full rounded-full h-11 font-semibold"
              >
                {isLoggingIn ? t("settings.loggingIn") : t("settings.login")}
              </Button>
            </div>
          )}

          {/* Pro Features Section */}
          {isAuthenticated && (
            <div className="space-y-5">
              <div className="flex items-center gap-2.5 text-sm font-semibold text-muted-foreground/80">
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground font-bold uppercase tracking-wider">
                  Pro
                </span>
                {t("settings.proFeatures")}
              </div>

              {/* Cloud Sync */}
              <div className="p-6 rounded-xl border border-border/40 bg-card/50 space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="p-2 rounded-full bg-primary/10">
                      <IconCloud className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{t("settings.cloudSync")}</p>
                      <p className="text-xs text-muted-foreground/80 mt-0.5">
                        {t("settings.cloudSyncDescription")}
                      </p>
                    </div>
                  </div>
                  {/* Pro-only badge or toggle (only when passphrase is set) */}
                  {!isSubscribed ? (
                    <span className="text-[10px] px-2 py-1 rounded-full bg-secondary text-muted-foreground font-bold uppercase tracking-tight">
                      {t("settings.proOnly")}
                    </span>
                  ) : (
                    cloudSyncStatus?.hasPassphrase && (
                      <div className="flex items-center gap-3">
                        {cloudSyncStatus?.enabled && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSyncNow}
                            disabled={isSyncing || isLoadingCloudSync}
                            className="rounded-full h-8 px-4 text-xs font-medium border-border/60"
                          >
                            {isSyncing ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              t("settings.syncNow", {
                                defaultValue: "Sync Now",
                              })
                            )}
                          </Button>
                        )}
                        <Switch
                          checked={cloudSyncStatus?.enabled ?? false}
                          onCheckedChange={handleCloudSyncToggle}
                          disabled={
                            isLoadingCloudSync ||
                            !cloudSyncStatus?.encryptionAvailable
                          }
                        />
                      </div>
                    )
                  )}
                </div>

                {/* Pro users: State-based UI */}
                {isSubscribed && cloudSyncStatus && (
                  <>
                    {
                      cloudSyncStatus.hasPassphrase ? (
                        /* Passphrase set: show status */
                        <div className="pt-5 border-t border-border/40 space-y-2.5">
                          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-medium">
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
                            <p className="text-xs text-red-500/90 font-medium">
                              {cloudSyncStatus.lastError}
                            </p>
                          )}
                        </div>
                      ) : (
                        /* Passphrase not set: input field + enable button */
                        <div className="pt-5 border-t border-border/40 space-y-4">
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {t("settings.setPassphraseDescription")}
                          </p>
                          <p className="text-sm text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200/50 dark:border-amber-800/30">
                            {t("settings.passphraseWarning")}
                          </p>
                          <div className="flex gap-2.5">
                            <Input
                              type="password"
                              placeholder={t("settings.passphrasePlaceholder")}
                              value={cloudSyncPassphrase}
                              onChange={(e) =>
                                setCloudSyncPassphrase(e.target.value)
                              }
                              className="flex-1 rounded-full px-4 border-border/60"
                            />
                            <Button
                              size="sm"
                              onClick={handleSetPassphraseAndEnable}
                              disabled={
                                isSettingPassphrase ||
                                !cloudSyncPassphrase.trim()
                              }
                              className="rounded-full px-6 font-semibold"
                            >
                              {isSettingPassphrase
                                ? t("common.saving")
                                : t("settings.enableCloudSync")}
                            </Button>
                          </div>
                        </div>
                      ) /* End passphrase not set */
                    }
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preferences Section */}
      <Card className="border-border/40 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">{t("settings.preferences")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {/* Theme */}
          <div className="flex items-center justify-between py-5 border-b border-border/30 last:border-0">
            <div className="space-y-1">
              <label className="text-sm font-semibold">
                {t("settings.theme")}
              </label>
              <p className="text-xs text-muted-foreground">
                {t("settings.themeDescription", {
                  defaultValue: "Choose how the application looks",
                })}
              </p>
            </div>
            <Select
              value={theme}
              onValueChange={(value: "light" | "dark" | "system") =>
                setTheme(value)
              }
            >
              <SelectTrigger className="w-[180px] rounded-full border-border/60">
                <SelectValue placeholder={t("settings.theme")} />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
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
          <div className="flex items-center justify-between py-5 border-b border-border/30 last:border-0">
            <div className="space-y-1">
              <label className="text-sm font-semibold">
                {t("settings.autoUpdate")}
              </label>
              <p className="text-xs text-muted-foreground max-w-[400px]">
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
          <div className="flex items-center justify-between py-5 border-b border-border/30 last:border-0">
            <div className="space-y-1">
              <label className="text-sm font-semibold">
                {t("settings.showWindowOnStartup")}
              </label>
              <p className="text-xs text-muted-foreground max-w-[400px]">
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
          <div className="flex items-center justify-between py-5 border-b border-border/30 last:border-0">
            <div className="space-y-1">
              <label className="text-sm font-semibold">
                {t("settings.loadExternalMCPConfigs")}
              </label>
              <p className="text-xs text-muted-foreground max-w-[400px]">
                {t("settings.loadExternalMCPConfigsDescription")}
              </p>
            </div>
            <Switch
              checked={loadExternalMCPConfigs}
              onCheckedChange={handleExternalMCPConfigsToggle}
              disabled={isSavingSettings}
            />
          </div>

          {/* Prefix Tool Names */}
          <div className="flex items-center justify-between py-5 border-b border-border/30 last:border-0">
            <div className="space-y-1">
              <label className="text-sm font-semibold">
                {t("settings.prefixToolNames")}
              </label>
              <p className="text-xs text-muted-foreground max-w-[400px]">
                {t("settings.prefixToolNamesDescription")}
              </p>
            </div>
            <Switch
              checked={prefixToolNames}
              onCheckedChange={handlePrefixToolNamesToggle}
              disabled={isSavingSettings}
            />
          </div>

          {/* Analytics */}
          <div className="flex items-center justify-between py-5 last:border-0">
            <div className="space-y-1">
              <label className="text-sm font-semibold">
                {t("settings.analytics")}
              </label>
              <p className="text-xs text-muted-foreground max-w-[400px]">
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
      <Card className="border-border/40 shadow-sm rounded-2xl overflow-hidden mb-10">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">{t("settings.community")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Discord */}
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("settings.communityDescription")}
            </p>
            <Button
              variant="outline"
              className="w-full flex items-center justify-center gap-2.5 rounded-full h-11 border-border/60 font-semibold"
              onClick={() =>
                window.open("https://discord.gg/dwG9jPrhxB", "_blank")
              }
            >
              <IconBrandDiscord className="h-5 w-5" />
              {t("settings.joinDiscord")}
            </Button>
          </div>

          {/* Feedback */}
          <div className="space-y-5 pt-6 border-t border-border/40">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("settings.feedbackDescription")}
            </p>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
              placeholder={t("feedback.placeholder")}
              className="text-sm rounded-xl p-4 border-border/60 resize-none focus-visible:ring-primary/20"
            />
            <Button
              onClick={handleSubmitFeedback}
              disabled={!feedback.trim() || isSendingFeedback}
              className="w-full rounded-full h-11 font-semibold"
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
