import { AppSettings } from "@mcp_router/shared";
import { getSharedConfigManager } from "../../infrastructure/shared-config-manager";

/**
 * Repository for managing application settings
 * Uses SharedConfigManager for shared configuration file storage
 */
export class SettingsRepository {
  private static instance: SettingsRepository | null = null;

  /**
   * Constructor
   */
  private constructor() {
    console.log(
      "[SettingsRepository] Using SharedConfigManager for settings storage",
    );
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SettingsRepository {
    if (!SettingsRepository.instance) {
      SettingsRepository.instance = new SettingsRepository();
    }
    return SettingsRepository.instance;
  }

  /**
   * Reset instance
   */
  public static resetInstance(): void {
    SettingsRepository.instance = null;
  }

  /**
   * Get application settings
   */
  public getSettings(): AppSettings {
    return getSharedConfigManager().getSettings();
  }

  /**
   * Save all settings at once
   */
  public saveSettings(settings: AppSettings): boolean {
    try {
      getSharedConfigManager().saveSettings(settings);
      return true;
    } catch (error) {
      console.error("Failed to save settings:", error);
      return false;
    }
  }
}
