import { DatabaseTableSchema } from "@mcp_router/shared";

/**
 * トークンテーブルのスキーマ定義
 */
export const TOKENS_SCHEMA: DatabaseTableSchema = {
  createSQL: `
    CREATE TABLE IF NOT EXISTS tokens (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      issued_at INTEGER NOT NULL,
      server_ids TEXT NOT NULL,
      scopes TEXT DEFAULT '[]'
    )
  `,
  indexes: [
    "CREATE INDEX IF NOT EXISTS idx_tokens_client_id ON tokens(client_id)",
  ],
};
