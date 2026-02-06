import { app, nativeTheme } from "electron";
import { AppSettings, Theme } from "@mcp_router/shared";
import { SingletonService } from "../singleton-service";
import { SettingsRepository } from "./settings.repository";

/**
 * Service for managing application settings
 */
export class SettingsService extends SingletonService<
  AppSettings,
  string,
  SettingsService
> {
  /**
   * Constructor
   */
  protected constructor() {
    super();
  }

  /**
   * Get entity name
   */
  protected getEntityName(): string {
    return "Settings";
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SettingsService {
    return (this as any).getInstanceBase();
  }

  /**
   * Reset instance
   * Used when switching workspaces
   */
  public static resetInstance(): void {
    (this as any).resetInstanceBase(SettingsService);
  }

  /**
   * Get application settings
   */
  public getSettings(): AppSettings {
    try {
      return SettingsRepository.getInstance().getSettings();
    } catch (error) {
      return this.handleError("settings retrieval", error);
    }
  }

  /**
   * Save all settings at once
   */
  public saveSettings(settings: AppSettings): boolean {
    try {
      const result = SettingsRepository.getInstance().saveSettings(settings);
      if (result) {
        applyLoginItemSettings(settings.showWindowOnStartup ?? true);
        applyThemeSettings(settings.theme);
      }
      return result;
    } catch (error) {
      return this.handleError("settings save", error, false);
    }
  }
}

/**
 * Get the singleton instance of SettingsService
 */
export function getSettingsService(): SettingsService {
  return SettingsService.getInstance();
}

/**
 * Update login item settings based on the show-window-on-startup preference
 */
export function applyLoginItemSettings(showWindowOnStartup: boolean): void {
  try {
    const loginItemOptions: Electron.Settings = {
      openAtLogin: true,
    };

    if (process.platform === "darwin") {
      loginItemOptions.openAsHidden = !showWindowOnStartup;
    } else if (process.platform === "win32") {
      loginItemOptions.args = showWindowOnStartup ? [] : ["--hidden"];
    }

    app.setLoginItemSettings(loginItemOptions);
  } catch (error) {
    console.error("Failed to update login item settings:", error);
  }
}

/**
 * Update the native theme based on the settings theme
 */
export function applyThemeSettings(theme?: Theme): void {
  try {
    nativeTheme.themeSource = theme ?? "system";
  } catch (error) {
    console.error("Failed to update native theme:", error);
  }
}
