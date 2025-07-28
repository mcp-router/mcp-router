import { SqliteManager } from "./sqlite-manager";
import { createAllTables, recreateOutdatedTables } from "./schema";

/**
 * Workspace-specific database migration
 * Creates necessary tables for each workspace database
 */
export class WorkspaceDatabaseMigration {
  private db: SqliteManager;

  constructor(db: SqliteManager) {
    this.db = db;
  }

  /**
   * Run all migrations
   */
  public runMigrations(): void {
    try {
      // まず、古いスキーマのテーブルを再作成
      recreateOutdatedTables(this.db);

      // すべてのテーブルを作成（統一されたスキーマ定義を使用）
      createAllTables(this.db);

      console.log("Workspace database initialization completed");
    } catch (error) {
      console.error("Failed to initialize workspace database:", error);
      throw error;
    }
  }
}
