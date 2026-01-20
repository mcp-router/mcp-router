import { app, nativeTheme } from "electron";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
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
   * アプリケーション設定を取得
   */
  public getSettings(): AppSettings {
    try {
      return SettingsRepository.getInstance().getSettings();
    } catch (error) {
      return this.handleError("設定取得", error);
    }
  }

  /**
   * 全ての設定を一度に保存
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
      return this.handleError("設定保存", error, false);
    }
  }
}

/**
 * SettingsServiceのシングルトンインスタンスを取得
 */
export function getSettingsService(): SettingsService {
  return SettingsService.getInstance();
}

/**
 * OS起動時のウィンドウ表示設定に応じてログイン項目設定を更新
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
    } else if (process.platform === "linux") {
      // Linux: use args to control window visibility
      loginItemOptions.args = showWindowOnStartup ? [] : ["--hidden"];
      // Also create/update autostart desktop file for better Linux compatibility
      createLinuxAutostartEntry(showWindowOnStartup);
    }

    app.setLoginItemSettings(loginItemOptions);
  } catch (error) {
    console.error("Failed to update login item settings:", error);
  }
}

/**
 * Create or update Linux autostart desktop entry
 */
function createLinuxAutostartEntry(showWindowOnStartup: boolean): void {
  if (process.platform !== "linux") return;

  try {

    const autostartDir = path.join(os.homedir(), ".config", "autostart");
    if (!fs.existsSync(autostartDir)) {
      fs.mkdirSync(autostartDir, { recursive: true });
    }

    const desktopFilePath = path.join(autostartDir, "mcp-router.desktop");
    const execPath = process.execPath;
    const execArgs = showWindowOnStartup ? "" : "--hidden";

    // Try to find icon path - check multiple possible locations
    let iconPath = "";
    const possibleIconPaths = [
      path.join(app.getAppPath(), "public", "images", "icon", "icon.png"),
      path.join(__dirname, "../../../../public/images/icon/icon.png"),
      path.join(process.resourcesPath, "app.asar", "public", "images", "icon", "icon.png"),
      path.join(process.resourcesPath, "app", "public", "images", "icon", "icon.png"),
    ];

    for (const iconFile of possibleIconPaths) {
      try {
        if (fs.existsSync(iconFile)) {
          iconPath = iconFile;
          break;
        }
      } catch {
        // Continue searching
      }
    }

    const desktopFileContent = `[Desktop Entry]
Type=Application
Name=MCP Router
Comment=Unified MCP Server Management App
Exec="${execPath}" ${execArgs}
${iconPath ? `Icon=${iconPath}` : ""}
Terminal=false
Categories=Utility;Development;
X-GNOME-Autostart-enabled=true
StartupNotify=false
`;

    fs.writeFileSync(desktopFilePath, desktopFileContent, { mode: 0o644 });
  } catch (error) {
    console.error("Failed to create Linux autostart entry:", error);
  }
}

/**
 * 設定のテーマに基づいてネイティブテーマを更新
 */
export function applyThemeSettings(theme?: Theme): void {
  try {
    nativeTheme.themeSource = theme ?? "system";
  } catch (error) {
    console.error("Failed to update native theme:", error);
  }
}
