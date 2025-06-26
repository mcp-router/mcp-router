import { AppSettings } from "@mcp-router/shared";
import { BaseService } from "./base-service";
import { Singleton } from "../../lib/utils/backend/singleton";
import { SettingsRepository, getSettingsRepository } from "../../lib/database";

/**
 * Service for managing application settings
 */
export class SettingsService
  extends BaseService<AppSettings, string>
  implements Singleton<SettingsService>
{
  private static instance: SettingsService | null = null;

  /**
   * Get singleton instance
   */
  public static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  /**
   * Reset instance
   * Used when switching workspaces
   */
  public static resetInstance(): void {
    SettingsService.instance = null;
  }

  private repository: SettingsRepository;

  /**
   * Constructor
   */
  private constructor() {
    super();
    this.repository = getSettingsRepository();
  }

  /**
   * Get entity name
   */
  protected getEntityName(): string {
    return "Settings";
  }

  /**
   * アプリケーション設定を取得
   */
  public getSettings(): AppSettings {
    try {
      return this.repository.getSettings();
    } catch (error) {
      return this.handleError("設定取得", error);
    }
  }

  /**
   * 全ての設定を一度に保存
   */
  public saveSettings(settings: AppSettings): boolean {
    try {
      return this.repository.saveSettings(settings);
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
