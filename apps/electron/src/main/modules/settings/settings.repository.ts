import {
  SqliteManager,
  getSqliteManager,
} from "../../infrastructure/database/sqlite-manager";
import { AppSettings, DEFAULT_APP_SETTINGS } from "@mcp_router/shared";

/**
 * アプリケーション設定を管理するリポジトリ
 */
export class SettingsRepository {
  private static instance: SettingsRepository | null = null;
  /**
   * テーブル作成SQL
   */
  private static readonly CREATE_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `;

  private db: SqliteManager;
  private settingsCache: AppSettings | null = null;

  /**
   * コンストラクタ
   */
  private constructor(db: SqliteManager) {
    this.db = db;
    console.log(
      "[SettingsRepository] Constructor called with database:",
      this.db?.getDbPath?.() || "database instance",
    );
    this.initializeTable();
    this.loadSettingsToCache();
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): SettingsRepository {
    const db = getSqliteManager();
    if (!SettingsRepository.instance || SettingsRepository.instance.db !== db) {
      SettingsRepository.instance = new SettingsRepository(db);
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
   * テーブルを初期化
   */
  private initializeTable(): void {
    try {
      // テーブルを作成
      this.db.execute(SettingsRepository.CREATE_TABLE_SQL);

      console.log("[SettingsRepository] テーブルの初期化が完了しました");
    } catch (error) {
      console.error("[SettingsRepository] テーブルの初期化中にエラー:", error);
      throw error;
    }
  }

  /**
   * 設定をキャッシュにロード
   */
  private loadSettingsToCache(): void {
    try {
      const settings: AppSettings = { ...DEFAULT_APP_SETTINGS };
      const rows = this.db.all<{ key: string; value: string }>(
        "SELECT key, value FROM settings",
      );
      rows.forEach((row) => {
        const key = row.key as keyof AppSettings;
        if (key in settings) {
          try {
            // JSON文字列をパースして元のデータ型を復元
            settings[key] = JSON.parse(row.value);
          } catch (_) {
            // パースに失敗した場合は文字列のままセット
            settings[key] = row.value as any;
          }
        }
      });
      this.settingsCache = settings;
    } catch (error) {
      console.error("設定のロードに失敗しました:", error);
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
          const stringValue =
            value !== undefined ? JSON.stringify(value) : JSON.stringify(null);
          this.db.execute(sql, [key, stringValue]);
        });
      });

      // キャッシュを更新
      this.settingsCache = { ...settings };

      return true;
    } catch (error) {
      console.error("設定の保存に失敗しました:", error);
      return false;
    }
  }
}
