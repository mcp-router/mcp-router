import { SqliteManager } from "../core/sqlite-manager";
import { RepositoryFactory } from "../factories/repository-factory";

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
      // 各リポジトリを初期化（テーブル作成が自動的に実行される）
      RepositoryFactory.getServerRepository(this.db);
      RepositoryFactory.getAgentRepository(this.db);
      RepositoryFactory.getDeployedAgentRepository(this.db);
      RepositoryFactory.getLogRepository(this.db);
      RepositoryFactory.getSessionRepository(this.db);
      RepositoryFactory.getSettingsRepository(this.db);
      RepositoryFactory.getTokenRepository(this.db);
      RepositoryFactory.getWorkspaceRepository(this.db);

      console.log("Workspace database initialization completed");
    } catch (error) {
      console.error("Failed to initialize workspace database:", error);
      throw error;
    }
  }
}
