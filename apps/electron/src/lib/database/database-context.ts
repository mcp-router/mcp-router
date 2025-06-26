import { SqliteManager } from "./sqlite-manager";

/**
 * Database context manager class
 * Provides the current workspace's database instance
 */
export class DatabaseContext {
  private static instance: DatabaseContext | null = null;
  private currentDatabase: SqliteManager | null = null;
  private databaseProvider: (() => Promise<SqliteManager>) | null = null;

  public static getInstance(): DatabaseContext {
    if (!DatabaseContext.instance) {
      DatabaseContext.instance = new DatabaseContext();
    }
    return DatabaseContext.instance;
  }

  private constructor() {}

  /**
   * Set the database provider function
   * This is called during initialization to avoid circular dependencies
   */
  public setDatabaseProvider(provider: () => Promise<SqliteManager>): void {
    this.databaseProvider = provider;
  }

  /**
   * Get the current workspace database
   */
  public async getCurrentDatabase(): Promise<SqliteManager> {
    if (this.currentDatabase) {
      return this.currentDatabase;
    }

    if (!this.databaseProvider) {
      throw new Error("Database provider not configured");
    }

    return await this.databaseProvider();
  }

  /**
   * Set the current database (called from Platform API Manager)
   */
  public setCurrentDatabase(db: SqliteManager | null): void {
    this.currentDatabase = db;
  }

  /**
   * Reset the database context
   */
  public reset(): void {
    this.currentDatabase = null;
  }
}

/**
 * データベースコンテキストのシングルトンインスタンスを取得
 */
export function getDatabaseContext(): DatabaseContext {
  return DatabaseContext.getInstance();
}

/**
 * 現在のワークスペースのデータベースを取得するヘルパー関数
 * 既存のgetSqliteManager()の代替として使用
 */
export async function getWorkspaceDatabase(): Promise<SqliteManager> {
  return getDatabaseContext().getCurrentDatabase();
}
