import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@mcp_router/ui";
import { useThemeStore } from "@/renderer/stores";
import { usePlatformAPI } from "@/renderer/platform-api";

const Settings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const platformAPI = usePlatformAPI();
  const { theme, setTheme } = useThemeStore();
  const [loadExternalMCPConfigs, setLoadExternalMCPConfigs] = useState(true);
  const [showWindowOnStartup, setShowWindowOnStartup] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
  };
  const getCurrentLanguage = () =>
    i18n.language.startsWith("ja")
      ? "ja"
      : i18n.language.startsWith("zh")
        ? "zh"
        : "en";
  useEffect(() => {
    platformAPI.settings
      .get()
      .then((settings) => {
        setLoadExternalMCPConfigs(settings.loadExternalMCPConfigs ?? true);
        setShowWindowOnStartup(settings.showWindowOnStartup ?? true);
      })
      .catch(() => console.error("Failed to load settings"));
  }, []);
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

  return (
    <div className="p-6 flex flex-col gap-6">
      <h1 className="text-3xl font-bold">{t("common.settings")}</h1>
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
        </CardContent>
      </Card>
    </div>
  );
};
export default Settings;
