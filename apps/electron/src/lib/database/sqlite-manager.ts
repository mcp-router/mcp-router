import * as path from "path";
import { app } from "electron";
import Database, {
  type Database as DatabaseType,
  RunResult,
} from "better-sqlite3";

/**
 * SQLiteデータベース管理クラス
 * BetterSQLite3のラッパーとして機能
 */
export class SqliteManager {
  private db: DatabaseType;
  private dbPath: string;

  /**
   * コンストラクタ
   * @param dbNameOrPath データベース名またはフルパス
   */
  constructor(dbNameOrPath: string) {
    // フルパスが渡された場合はそのまま使用、それ以外はuserDataディレクトリに配置
    if (path.isAbsolute(dbNameOrPath)) {
      this.dbPath = dbNameOrPath;
    } else {
      const dbDir = app.getPath("userData");
      this.dbPath = path.join(dbDir, `${dbNameOrPath}.db`);
    }

    // ディレクトリが存在しない場合は作成
    try {
      const fs = require("fs");
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
    } catch (error) {
      console.error("データベースディレクトリの作成に失敗しました:", error);
      throw error;
    }

    // データベース接続
    try {
      this.db = new Database(this.dbPath);

      // プラグマ設定
      this.db.pragma("journal_mode = WAL");
      this.db.pragma("foreign_keys = ON");
    } catch (error) {
      console.error(
        `データベース '${dbNameOrPath}' の初期化に失敗しました:`,
        error,
      );
      throw error;
    }
  }

  /**
   * データベース接続インスタンスを取得
   */
  public getConnection(): DatabaseType {
    return this.db;
  }

  /**
   * データベースファイルのパスを取得
   */
  public getDbPath(): string {
    return this.dbPath;
  }

  /**
   * SQLクエリを実行（トランザクションなし）
   * @param sql SQL文
   * @param params パラメータ
   */
  public execute(sql: string, params: any = {}): RunResult {
    try {
      return this.db.prepare(sql).run(params);
    } catch (error) {
      console.error("SQLクエリの実行に失敗しました:", error);
      throw error;
    }
  }

  /**
   * SQLクエリを実行し、結果を取得（単一行）
   * @param sql SQL文
   * @param params パラメータ
   */
  public get<T>(sql: string, params: any = {}): T | undefined {
    try {
      return this.db.prepare(sql).get(params) as T | undefined;
    } catch (error) {
      console.error("SQLクエリの実行に失敗しました:", error);
      throw error;
    }
  }

  /**
   * SQLクエリを実行し、結果を取得（複数行）
   * @param sql SQL文
   * @param params パラメータ
   */
  public all<T>(sql: string, params: any = {}): T[] {
    try {
      return this.db.prepare(sql).all(params) as T[];
    } catch (error) {
      console.error("SQLクエリの実行に失敗しました:", error);
      throw error;
    }
  }

  /**
   * トランザクションを実行
   * @param callback トランザクション内で実行する関数
   */
  public transaction<T>(callback: () => T): T {
    try {
      // トランザクションの作成
      const transaction = this.db.transaction(callback);
      return transaction();
    } catch (error) {
      console.error("トランザクションの実行に失敗しました:", error);
      throw error;
    }
  }

  /**
   * データベース接続を閉じる
   */
  public close(): void {
    try {
      this.db.close();
    } catch (error) {
      console.error("データベース接続のクローズに失敗しました:", error);
      throw error;
    }
  }

  /**
   * ステートメントを準備
   * @param sql SQL文
   */
  public prepare(sql: string): any {
    try {
      return this.db.prepare(sql);
    } catch (error) {
      console.error("ステートメントの準備に失敗しました:", error);
      throw error;
    }
  }

  /**
   * 複数のSQL文を実行
   * @param sql SQL文（複数可）
   */
  public exec(sql: string): void {
    try {
      this.db.exec(sql);
    } catch (error) {
      console.error("SQLの実行に失敗しました:", error);
      throw error;
    }
  }
}

/**
 * SQLiteManagerのシングルトンインスタンス（互換性のために残す）
 */
export class SqliteManagerSingleton {
  private static instance: SqliteManager | null = null;

  /**
   * SQLiteManagerのシングルトンインスタンスを取得
   */
  public static getInstance(dbName = "mcprouter"): SqliteManager {
    if (!SqliteManagerSingleton.instance) {
      SqliteManagerSingleton.instance = new SqliteManager(dbName);
    }
    return SqliteManagerSingleton.instance;
  }
}

// グローバルなワークスペースデータベース参照
let currentWorkspaceDb: SqliteManager | null = null;

/**
 * ワークスペースデータベースを設定（PlatformAPIManagerから呼び出される）
 */
export function setWorkspaceDatabase(db: SqliteManager | null): void {
  console.log(
    "[setWorkspaceDatabase] Setting workspace DB:",
    db ? "Set" : "Cleared",
  );
  currentWorkspaceDb = db;
}

/**
 * 現在のワークスペースのSQLiteManagerインスタンスを取得
 * ワークスペース切り替えに対応
 * @param dbName データベース名
 * @param forceMain true の場合、ワークスペースが設定されていてもメインDBを返す
 */
export function getSqliteManager(dbName = "mcprouter", forceMain = false): SqliteManager {
  // forceMainがtrueの場合、常にメインデータベースを使用
  if (forceMain) {
    return SqliteManagerSingleton.getInstance(dbName);
  }

  // ワークスペースデータベースが設定されている場合はそれを使用
  // 注意: ワークスペースモードでは引数のdbNameは無視される
  if (currentWorkspaceDb) {
    // デバッグログは開発時のみ（過度なログ出力を防ぐ）
    // console.log("[getSqliteManager] Returning workspace DB (ignoring dbName:", dbName, ")");
    return currentWorkspaceDb;
  }

  // フォールバック：従来のシングルトンパターン（初期化時のみ）
  console.log(
    "[getSqliteManager] WARNING: No workspace DB set, falling back to singleton DB:",
    dbName,
  );
  return SqliteManagerSingleton.getInstance(dbName);
}
