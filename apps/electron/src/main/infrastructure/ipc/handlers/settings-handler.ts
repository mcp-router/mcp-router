import { ipcMain } from "electron";
import { getSettingsService } from "@/main/application/settings/settings-service";

export function setupSettingsHandlers(): void {
  ipcMain.handle("settings:get", () => {
    try {
      const settingsService = getSettingsService();
      return settingsService.getSettings();
    } catch (error) {
      console.error("Failed to get settings:", error);
      return { authBypassEnabled: false };
    }
  });

  ipcMain.handle("settings:save", (_, settings: any) => {
    try {
      const settingsService = getSettingsService();
      return settingsService.saveSettings(settings);
    } catch (error) {
      console.error("Failed to save settings:", error);
      return false;
    }
  });

  ipcMain.handle("settings:increment-package-manager-overlay-count", () => {
    try {
      const settingsService = getSettingsService();
      const currentSettings = settingsService.getSettings();
      const newCount =
        (currentSettings.packageManagerOverlayDisplayCount || 0) + 1;
      const updatedSettings = {
        ...currentSettings,
        packageManagerOverlayDisplayCount: newCount,
      };
      const success = settingsService.saveSettings(updatedSettings);
      return { success, count: newCount };
    } catch (error) {
      console.error(
        "Failed to increment package manager overlay display count:",
        error,
      );
      return { success: false, count: 0 };
    }
  });
}
