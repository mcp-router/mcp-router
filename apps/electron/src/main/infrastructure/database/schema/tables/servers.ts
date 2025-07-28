import { DatabaseTableSchema } from "@mcp_router/shared";

/**
 * サーバーテーブルのスキーマ定義
 */
export const SERVERS_SCHEMA: DatabaseTableSchema = {
  createSQL: `
    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      command TEXT,
      args TEXT,
      env TEXT,
      auto_start INTEGER NOT NULL,
      disabled INTEGER NOT NULL,
      auto_approve TEXT,
      context_path TEXT,
      server_type TEXT NOT NULL DEFAULT 'local',
      remote_url TEXT,
      bearer_token TEXT,
      input_params TEXT,
      description TEXT,
      version TEXT,
      latest_version TEXT,
      verification_status TEXT,
      required_params TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `,
  indexes: ["CREATE INDEX IF NOT EXISTS idx_servers_name ON servers(name)"],
};

/**
 * 必須カラム定義
 */
export const SERVERS_REQUIRED_COLUMNS = ["server_type"];
