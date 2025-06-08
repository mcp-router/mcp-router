import { AppSettings } from '../types/settings-types';
import { BaseService } from './base-service';
import { Singleton } from '../utils/singleton';
import { SettingsRepository, getSettingsRepository } from '../database/settings-repository';

/**
 * アプリケーション設定を管理するサービス
 */
export class SettingsService extends BaseService<AppSettings, string> implements Singleton<SettingsService> {
  private static instance: SettingsService | null = null;
  
  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }
  
  private repository: SettingsRepository;
  
  /**
   * コンストラクタ
   */
  private constructor() {
    super();
    this.repository = getSettingsRepository();
  }
  
  /**
   * エンティティ名を取得
   */
  protected getEntityName(): string {
    return '設定';
  }

  /**
   * アプリケーション設定を取得
   */
  public getSettings(): AppSettings {
    try {
      return this.repository.getSettings();
    } catch (error) {
      return this.handleError('設定取得', error);
    }
  }
  
  /**
   * 全ての設定を一度に保存
   */
  public saveSettings(settings: AppSettings): boolean {
    try {
      return this.repository.saveSettings(settings);
    } catch (error) {
      return this.handleError('設定保存', error, false);
    }
  }
}

/**
 * SettingsServiceのシングルトンインスタンスを取得
 */
export function getSettingsService(): SettingsService {
  return SettingsService.getInstance();
}
