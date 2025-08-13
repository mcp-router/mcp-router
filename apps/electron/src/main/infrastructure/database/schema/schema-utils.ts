import { SqliteManager } from "../core/sqlite-manager";
import { DATABASE_SCHEMA, SCHEMA_VERSION, TableName } from "./database-schema";

/**
 * テーブルを作成する
 */
function createTable(db: SqliteManager, tableName: TableName): void {
  const schema = DATABASE_SCHEMA[tableName];
  if (!schema) {
    throw new Error(`Unknown table: ${tableName}`);
  }

  // テーブルを作成
  db.exec(schema.createSQL);

  // インデックスを作成
  if (schema.indexes && schema.indexes.length > 0) {
    schema.indexes.forEach((indexSQL) => {
      db.exec(indexSQL);
    });
  }
}

/**
 * すべてのテーブルを作成する
 */
export function createAllTables(db: SqliteManager): void {
  const tableNames = Object.keys(DATABASE_SCHEMA) as TableName[];

  db.transaction(() => {
    tableNames.forEach((tableName) => {
      createTable(db, tableName);
    });
  });
}

/**
 * テーブルのスキーマが最新かチェックする
 */
function isTableSchemaOutdated(
  db: SqliteManager,
  tableName: TableName,
): boolean {
  try {
    const tableInfo = db.all(`PRAGMA table_info(${tableName})`);
    if (tableInfo.length === 0) {
      return false; // テーブルが存在しない場合はfalse（作成される）
    }

    const existingColumns = tableInfo.map((col: any) => col.name);
    const requiredColumns =
      SCHEMA_VERSION.REQUIRED_COLUMNS[
        tableName as keyof typeof SCHEMA_VERSION.REQUIRED_COLUMNS
      ];

    if (requiredColumns) {
      // 必須カラムがすべて存在するかチェック
      return !requiredColumns.every((col) => existingColumns.includes(col));
    }

    return false;
  } catch (error) {
    console.error(`Error checking table schema for ${tableName}:`, error);
    return false;
  }
}

/**
 * 古いスキーマのテーブルを削除して再作成する
 */
export function recreateOutdatedTables(db: SqliteManager): void {
  const tableNames = Object.keys(DATABASE_SCHEMA) as TableName[];

  tableNames.forEach((tableName) => {
    if (isTableSchemaOutdated(db, tableName)) {
      console.log(`[Schema] Dropping outdated table: ${tableName}`);
      db.exec(`DROP TABLE IF EXISTS ${tableName}`);
    }
  });
}
