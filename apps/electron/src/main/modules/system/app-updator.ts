import { app } from "electron";
import type { IUpdateElectronAppOptions } from "update-electron-app";
import { getSettingsService } from "@/main/modules/settings/settings.service";
import { isProduction } from "@/main/utils/environment";

type AutoUpdateConfig = {
  enabled: boolean;
  options?: IUpdateElectronAppOptions;
};

const DEFAULT_AUTO_UPDATE_OPTIONS: IUpdateElectronAppOptions = {
  notifyUser: false,
};

/**
 * Determine whether auto-update should run and return options for update-electron-app
 * Errors are swallowed to avoid crashing on environments (e.g., unsigned macOS builds)
 */
export function resolveAutoUpdateConfig(): AutoUpdateConfig {
  try {
    const settingsService = getSettingsService();
    const settings = settingsService.getSettings();
    const autoUpdateEnabled = settings.autoUpdateEnabled ?? true;

    const shouldEnableAutoUpdate =
      isProduction() && app.isPackaged && autoUpdateEnabled;

    if (!shouldEnableAutoUpdate) {
      return { enabled: false };
    }

    return {
      enabled: true,
      options: DEFAULT_AUTO_UPDATE_OPTIONS,
    };
  } catch {
    return { enabled: false };
  }
}
