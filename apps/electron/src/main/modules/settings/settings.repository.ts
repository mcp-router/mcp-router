import { AppSettings } from "@mcp_router/shared";
import { getSharedConfigManager } from "../../infrastructure/shared-config-manager";

/**
 * アプリケーション設定を管理するリポジトリ
 * SharedConfigManagerを使用して共通設定ファイルで管理
 */
export class SettingsRepository {
  private static instance: SettingsRepository | null = null;

  /**
   * コンストラクタ
   */
  private constructor() {
    console.log(
      "[SettingsRepository] Using SharedConfigManager for settings storage",
    );
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): SettingsRepository {
    if (!SettingsRepository.instance) {
      SettingsRepository.instance = new SettingsRepository();
    }
    return SettingsRepository.instance;
  }

  /**
   * インスタンスをリセット
   */
  public static resetInstance(): void {
    SettingsRepository.instance = null;
  }

  /**
   * アプリケーション設定を取得
   */
  public getSettings(): AppSettings {
    return getSharedConfigManager().getSettings();
  }

  /**
   * 全ての設定を一度に保存
   */
  public saveSettings(settings: AppSettings): boolean {
    try {
      getSharedConfigManager().saveSettings(settings);
      return true;
    } catch (error) {
      console.error("設定の保存に失敗しました:", error);
      return false;
    }
  }
}
