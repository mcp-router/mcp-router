import * as path from 'path';
import { app } from 'electron';
import Database, { type Database as DatabaseType, RunResult } from 'better-sqlite3';

/**
 * SQLiteデータベース管理クラス
 * BetterSQLite3のラッパーとして機能
 */
export class SqliteManager {
  private db: DatabaseType;
  
  /**
   * コンストラクタ
   * @param dbName データベース名
   */
  constructor(dbName: string) {
    // データベースファイルのパスを作成
    const dbDir = app.getPath('userData');
    const dbPath = path.join(dbDir, `${dbName}.db`);
    
    
    // ディレクトリが存在しない場合は作成
    try {
      const fs = require('fs');
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
    } catch (error) {
      console.error('データベースディレクトリの作成に失敗しました:', error);
      throw error;
    }
    
    // データベース接続
    try {
      this.db = new Database(dbPath);
      
      // プラグマ設定
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
    } catch (error) {
      console.error(`データベース '${dbName}' の初期化に失敗しました:`, error);
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
   * SQLクエリを実行（トランザクションなし）
   * @param sql SQL文
   * @param params パラメータ
   */
  public execute(sql: string, params: any = {}): RunResult {
    try {
      return this.db.prepare(sql).run(params);
    } catch (error) {
      console.error('SQLクエリの実行に失敗しました:', error);
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
      console.error('SQLクエリの実行に失敗しました:', error);
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
      console.error('SQLクエリの実行に失敗しました:', error);
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
      console.error('トランザクションの実行に失敗しました:', error);
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
      console.error('データベース接続のクローズに失敗しました:', error);
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
      console.error('ステートメントの準備に失敗しました:', error);
      throw error;
    }
  }
}

/**
 * SQLiteManagerのシングルトンインスタンス
 */
export class SqliteManagerSingleton {
  private static instance: SqliteManager | null = null;

  /**
   * SQLiteManagerのシングルトンインスタンスを取得
   */
  public static getInstance(dbName = 'mcprouter'): SqliteManager {
    if (!SqliteManagerSingleton.instance) {
      SqliteManagerSingleton.instance = new SqliteManager(dbName);
    }
    return SqliteManagerSingleton.instance;
  }
}

/**
 * SQLiteManagerのシングルトンインスタンスを取得
 */
export function getSqliteManager(dbName = 'mcprouter'): SqliteManager {
  return SqliteManagerSingleton.getInstance(dbName);
}
