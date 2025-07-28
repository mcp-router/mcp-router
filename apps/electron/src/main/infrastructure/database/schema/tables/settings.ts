import { DatabaseTableSchema } from "@mcp_router/shared";

/**
 * 設定テーブルのスキーマ定義
 */
export const SETTINGS_SCHEMA: DatabaseTableSchema = {
  createSQL: `
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `,
  indexes: [],
};

/**
 * 必須カラム定義
 */
const SETTINGS_REQUIRED_COLUMNS: string[] = [];
