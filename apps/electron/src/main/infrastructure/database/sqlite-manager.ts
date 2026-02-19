import * as path from "path";
import * as fs from "fs";
import { app } from "electron";
import Database, {
  type Database as DatabaseType,
  RunResult,
} from "better-sqlite3";

/**
 * SQLite database management class.
 * Acts as a wrapper around BetterSQLite3.
 */
export class SqliteManager {
  private db: DatabaseType;
  private dbPath: string;
  private stmtCache = new Map<string, ReturnType<DatabaseType["prepare"]>>();

  /**
   * Constructor
   * @param dbNameOrPath Database name or full path
   */
  constructor(dbNameOrPath: string) {
    // Use the full path as-is if provided, otherwise place in userData directory
    if (path.isAbsolute(dbNameOrPath)) {
      this.dbPath = dbNameOrPath;
    } else {
      const dbDir = app.getPath("userData");
      this.dbPath = path.join(dbDir, `${dbNameOrPath}.db`);
    }

    // Create directory if it does not exist
    try {
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
    } catch (error) {
      console.error("Failed to create database directory:", error);
      throw error;
    }

    // Connect to database
    try {
      this.db = new Database(this.dbPath);

      // Pragma settings
      this.db.pragma("journal_mode = WAL");
      this.db.pragma("foreign_keys = ON");
    } catch (error) {
      console.error(`Failed to initialize database '${dbNameOrPath}':`, error);
      throw error;
    }
  }

  /**
   * Get the database connection instance
   */
  public getConnection(): DatabaseType {
    return this.db;
  }

  /**
   * Get the database file path
   */
  public getDbPath(): string {
    return this.dbPath;
  }

  /**
   * Get a cached prepared statement, creating it if needed.
   */
  private getStatement(sql: string): ReturnType<DatabaseType["prepare"]> {
    let stmt = this.stmtCache.get(sql);
    if (!stmt) {
      stmt = this.db.prepare(sql);
      this.stmtCache.set(sql, stmt);
    }
    return stmt;
  }

  /**
   * Execute an SQL query (no transaction)
   * @param sql SQL statement
   * @param params Parameters
   */
  public execute(sql: string, params: any = {}): RunResult {
    try {
      return this.getStatement(sql).run(params);
    } catch (error) {
      console.error("Failed to execute SQL query:", error);
      throw error;
    }
  }

  /**
   * Execute an SQL query and get the result (single row)
   * @param sql SQL statement
   * @param params Parameters
   */
  public get<T>(sql: string, params: any = {}): T | undefined {
    try {
      return this.getStatement(sql).get(params) as T | undefined;
    } catch (error) {
      console.error("Failed to execute SQL query:", error);
      throw error;
    }
  }

  /**
   * Execute an SQL query and get results (multiple rows)
   * @param sql SQL statement
   * @param params Parameters
   */
  public all<T>(sql: string, params: any = {}): T[] {
    try {
      return this.getStatement(sql).all(params) as T[];
    } catch (error) {
      console.error("Failed to execute SQL query:", error);
      throw error;
    }
  }

  /**
   * Execute a transaction
   * @param callback Function to execute within the transaction
   */
  public transaction<T>(callback: () => T): T {
    try {
      // Create transaction
      const transaction = this.db.transaction(callback);
      return transaction();
    } catch (error) {
      console.error("Failed to execute transaction:", error);
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  public close(): void {
    try {
      this.stmtCache.clear();
      this.db.close();
    } catch (error) {
      console.error("Failed to close database connection:", error);
      throw error;
    }
  }

  /**
   * Prepare a statement
   * @param sql SQL statement
   */
  public prepare(sql: string): any {
    try {
      return this.db.prepare(sql);
    } catch (error) {
      console.error("Failed to prepare statement:", error);
      throw error;
    }
  }

  /**
   * Execute multiple SQL statements
   * @param sql SQL statements
   */
  public exec(sql: string): void {
    try {
      this.db.exec(sql);
    } catch (error) {
      console.error("Failed to execute SQL:", error);
      throw error;
    }
  }
}

/**
 * SqliteManager singleton class.
 * Manages a single database instance.
 */
class SqliteManagerSingleton {
  private static instance: SqliteManager | null = null;

  /**
   * Get the SqliteManager singleton instance
   */
  public static getInstance(dbName = "mcprouter"): SqliteManager {
    if (!SqliteManagerSingleton.instance) {
      SqliteManagerSingleton.instance = new SqliteManager(dbName);
    }
    return SqliteManagerSingleton.instance;
  }
}

// Global workspace database reference
let currentWorkspaceDb: SqliteManager | null = null;

/**
 * Set the workspace database (called from PlatformAPIManager)
 */
export function setWorkspaceDatabase(db: SqliteManager | null): void {
  console.log(
    "[setWorkspaceDatabase] Setting workspace DB:",
    db ? "Set" : "Cleared",
  );
  currentWorkspaceDb = db;
}

/**
 * Get the SqliteManager instance for the current workspace.
 * Supports workspace switching.
 * @param dbName Database name
 * @param forceMain If true, returns main DB even if a workspace is set
 */
export function getSqliteManager(
  dbName = "mcprouter",
  forceMain = false,
): SqliteManager {
  // If forceMain is true, always use the main database
  if (forceMain) {
    return SqliteManagerSingleton.getInstance(dbName);
  }

  // Use workspace database if one is set
  // Note: In workspace mode, the dbName argument is ignored
  if (currentWorkspaceDb) {
    // Debug log only during development (avoid excessive logging)
    // console.log("[getSqliteManager] Returning workspace DB (ignoring dbName:", dbName, ")");
    return currentWorkspaceDb;
  }

  // Fallback: legacy singleton pattern (only during initialization)
  console.log(
    "[getSqliteManager] WARNING: No workspace DB set, falling back to singleton DB:",
    dbName,
  );
  return SqliteManagerSingleton.getInstance(dbName);
}
