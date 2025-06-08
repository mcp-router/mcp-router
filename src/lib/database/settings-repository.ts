import { Singleton } from '../utils/singleton';
import { SqliteManager, getSqliteManager } from './sqlite-manager';
import { AppSettings, DEFAULT_APP_SETTINGS } from '../types/settings-types';

/**
 * アプリケーション設定を管理するリポジトリ
 */
export class SettingsRepository implements Singleton<SettingsRepository> {
  private static instance: SettingsRepository | null = null;
  private db: SqliteManager;
  private settingsCache: AppSettings | null = null;

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
   * コンストラクタ
   */
  private constructor() {
    this.db = getSqliteManager();
    this.initializeTable();
    this.loadSettingsToCache();
  }

  /**
   * テーブルを初期化
   */
  private initializeTable(): void {
    const sql = `
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `;
    this.db.execute(sql);
  }

  /**
   * 設定をキャッシュにロード
   */
  private loadSettingsToCache(): void {
    try {
      const settings: AppSettings = { ...DEFAULT_APP_SETTINGS };
      const rows = this.db.all<{key: string, value: string}>('SELECT key, value FROM settings');
      rows.forEach(row => {
        const key = row.key as keyof AppSettings;
        if (key in settings) {
          try {
            // JSON文字列をパースして元のデータ型を復元
            settings[key] = JSON.parse(row.value);
          } catch (e) {
            // パースに失敗した場合は文字列のままセット
            settings[key] = row.value as any;
          }
        }
      });
      this.settingsCache = settings;
    } catch (error) {
      console.error('設定のロードに失敗しました:', error);
      this.settingsCache = { ...DEFAULT_APP_SETTINGS };
    }
  }

  /**
   * アプリケーション設定を取得
   */
  public getSettings(): AppSettings {
    if (!this.settingsCache) {
      this.loadSettingsToCache();
    }
    return { ...this.settingsCache! };
  }

  /**
   * 全ての設定を一度に保存
   */
  public saveSettings(settings: AppSettings): boolean {
    try {
      // トランザクションで全ての設定を保存
      this.db.transaction(() => {
        const sql = `
          INSERT OR REPLACE INTO settings (key, value)
          VALUES (?, ?)
        `;

        // 設定オブジェクトの各キーと値をデータベースに保存
        Object.entries(settings).forEach(([key, value]) => {
          // 値をJSON文字列に変換して保存
          const stringValue = value !== undefined ? JSON.stringify(value) : JSON.stringify(null);
          this.db.execute(sql, [key, stringValue]);
        });
      });
      
      // キャッシュを更新
      this.settingsCache = { ...settings };
      
      return true;
    } catch (error) {
      console.error('設定の保存に失敗しました:', error);
      return false;
    }
  }
}

/**
 * SettingsRepositoryのシングルトンインスタンスを取得
 */
export function getSettingsRepository(): SettingsRepository {
  return SettingsRepository.getInstance();
}
