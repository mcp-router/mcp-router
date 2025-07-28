import { DatabaseTableSchema } from "@mcp_router/shared";

/**
 * マイグレーションテーブルのスキーマ定義
 */
export const MIGRATIONS_SCHEMA: DatabaseTableSchema = {
  createSQL: `
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      executed_at INTEGER NOT NULL
    )
  `,
  indexes: [],
};

/**
 * 必須カラム定義
 */
const MIGRATIONS_REQUIRED_COLUMNS: string[] = [];
