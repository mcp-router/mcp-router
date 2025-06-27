import { SqliteManager } from "./sqlite-manager";
import { v4 as uuidv4 } from "uuid";

/**
 * リポジトリの基本クラス
 * SQLiteデータベースを使用したCRUD操作を提供
 * @template T エンティティの型
 */
export abstract class BaseRepository<T extends { id: string }> {
  protected db: SqliteManager;
  protected tableName: string;

  /**
   * 現在のデータベースインスタンスを取得（外部から比較用）
   */
  public get database(): SqliteManager {
    return this.db;
  }

  /**
   * コンストラクタ
   * @param db SqliteManagerインスタンス
   * @param tableName テーブル名
   */
  constructor(db: SqliteManager, tableName: string) {
    this.db = db;
    this.tableName = tableName;

    // テーブルの初期化
    this.initializeTable();
  }

  /**
   * テーブルを初期化する抽象メソッド
   * 各サブクラスで実装が必要
   */
  protected abstract initializeTable(): void;

  /**
   * エンティティのリストを取得
   * @param options 取得オプション
   */
  public getAll(options: any = {}): T[] {
    try {
      // Check if table exists before query
      const tableExists = this.db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
        [this.tableName],
      );

      if (!tableExists) {
        console.warn(
          `Table ${this.tableName} does not exist, returning empty array`,
        );
        return [];
      }

      // SQLクエリを構築
      let sql = `SELECT * FROM ${this.tableName}`;
      const params: any = {};

      // WHERE句を追加（オプション）
      if (options.where) {
        const whereClauses = Object.entries(options.where)
          .map(([key, value]) => `${key} = :${key}`)
          .join(" AND ");

        if (whereClauses) {
          sql += ` WHERE ${whereClauses}`;

          // パラメータを設定
          Object.entries(options.where).forEach(([key, value]) => {
            params[key] = value;
          });
        }
      }

      // ORDER BY句を追加（オプション）
      if (options.orderBy) {
        sql += ` ORDER BY ${options.orderBy}`;

        if (options.order) {
          sql += ` ${options.order}`;
        }
      }

      // LIMIT句を追加（オプション）
      if (options.limit) {
        sql += ` LIMIT :limit`;
        params.limit = options.limit;

        if (options.offset) {
          sql += ` OFFSET :offset`;
          params.offset = options.offset;
        }
      }

      // クエリを実行
      const rows = this.db.all<any>(sql, params);

      // エンティティに変換
      return rows.map((row) => this.mapRowToEntity(row));
    } catch (error) {
      console.error(`${this.tableName}の取得中にエラーが発生しました:`, error);
      throw error;
    }
  }

  /**
   * IDでエンティティを取得
   * @param id エンティティのID
   */
  public getById(id: string): T | undefined {
    try {
      const sql = `SELECT * FROM ${this.tableName} WHERE id = :id`;
      const row = this.db.get<any>(sql, { id });

      if (!row) {
        return undefined;
      }

      // エンティティに変換
      return this.mapRowToEntity(row);
    } catch (error) {
      console.error(
        `${this.tableName}のID:${id}の取得中にエラーが発生しました:`,
        error,
      );
      throw error;
    }
  }

  /**
   * 条件に一致する最初のエンティティを取得
   * @param whereClause WHERE句
   * @param params パラメータ
   */
  public findOne(whereClause: string, params: any[] = []): T | null {
    try {
      const sql = `SELECT * FROM ${this.tableName} WHERE ${whereClause} LIMIT 1`;
      const row = this.db.get<any>(sql, params);

      if (!row) {
        return null;
      }

      // エンティティに変換
      return this.mapRowToEntity(row);
    } catch (error) {
      console.error(`${this.tableName}の検索中にエラーが発生しました:`, error);
      throw error;
    }
  }

  /**
   * IDでエンティティを取得（findByIdエイリアス）
   * @param id エンティティのID
   */
  public findById(id: string): T | null {
    const result = this.getById(id);
    return result || null;
  }

  /**
   * エンティティを追加
   * @param data 追加するエンティティ
   */
  public add(data: Omit<T, "id">): T {
    try {
      // IDが指定されていない場合は生成
      const entityWithId = {
        ...data,
        id: (data as any).id || uuidv4(),
      } as T;

      // エンティティをデータベース行に変換
      const row = this.mapEntityToRow(entityWithId);

      // カラム名と値のプレースホルダを生成
      const columns = Object.keys(row).join(", ");
      const placeholders = Object.keys(row)
        .map((key) => `:${key}`)
        .join(", ");

      // SQL文を構築
      const sql = `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders})`;

      // クエリを実行
      this.db.execute(sql, row);

      return entityWithId;
    } catch (error) {
      console.error(`${this.tableName}の追加中にエラーが発生しました:`, error);
      throw error;
    }
  }

  /**
   * エンティティを更新
   * @param id 更新対象のID
   * @param data 更新データ
   */
  public update(id: string, data: Partial<T>): T | undefined {
    try {
      // 既存のエンティティを取得
      const existingEntity = this.getById(id);
      if (!existingEntity) {
        return undefined;
      }

      // 更新されたエンティティを作成
      const updatedEntity = {
        ...existingEntity,
        ...data,
        id, // IDは上書きされないようにする
      };

      // エンティティをデータベース行に変換
      const row = this.mapEntityToRow(updatedEntity);

      // SET句を生成
      const setClauses = Object.keys(row)
        .filter((key) => key !== "id") // IDは更新しない
        .map((key) => `${key} = :${key}`)
        .join(", ");

      // SQL文を構築
      const sql = `UPDATE ${this.tableName} SET ${setClauses} WHERE id = :id`;

      // クエリを実行
      this.db.execute(sql, row);

      return updatedEntity;
    } catch (error) {
      console.error(
        `${this.tableName}のID:${id}の更新中にエラーが発生しました:`,
        error,
      );
      throw error;
    }
  }

  /**
   * エンティティを削除
   * @param id 削除対象のID
   */
  public delete(id: string): boolean {
    try {
      // SQL文を構築
      const sql = `DELETE FROM ${this.tableName} WHERE id = :id`;

      // クエリを実行
      this.db.execute(sql, { id });

      return true;
    } catch (error) {
      console.error(
        `${this.tableName}のID:${id}の削除中にエラーが発生しました:`,
        error,
      );
      return false;
    }
  }

  /**
   * カウントを取得
   * @param whereClause WHERE句（オプション）
   */
  public count(whereClause?: { [key: string]: any }): number {
    try {
      // SQLクエリを構築
      let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
      const params: any = {};

      // WHERE句を追加（オプション）
      if (whereClause) {
        const conditions = Object.entries(whereClause)
          .map(([key, value]) => `${key} = :${key}`)
          .join(" AND ");

        if (conditions) {
          sql += ` WHERE ${conditions}`;

          // パラメータを設定
          Object.entries(whereClause).forEach(([key, value]) => {
            params[key] = value;
          });
        }
      }

      // クエリを実行
      const result = this.db.get<{ count: number }>(sql, params);

      return result?.count || 0;
    } catch (error) {
      console.error(
        `${this.tableName}のカウント取得中にエラーが発生しました:`,
        error,
      );
      throw error;
    }
  }

  /**
   * トランザクションを実行
   * @param callback トランザクション内で実行する関数
   */
  public transaction<R>(callback: () => R): R {
    return this.db.transaction(callback);
  }

  /**
   * データベース行をエンティティに変換する抽象メソッド
   * 各サブクラスで実装が必要
   * @param row データベース行
   */
  protected abstract mapRowToEntity(row: any): T;

  /**
   * エンティティをデータベース行に変換する抽象メソッド
   * 各サブクラスで実装が必要
   * @param entity エンティティ
   */
  protected abstract mapEntityToRow(entity: T): Record<string, any>;
}
