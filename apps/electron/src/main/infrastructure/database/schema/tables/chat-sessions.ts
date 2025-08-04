import { DatabaseTableSchema } from "@mcp_router/shared";

/**
 * チャットセッションテーブルのスキーマ定義
 */
export const CHAT_SESSIONS_SCHEMA: DatabaseTableSchema = {
  createSQL: `
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      title TEXT,
      messages TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
      source TEXT NOT NULL DEFAULT 'ui'
    )
  `,
  indexes: [
    "CREATE INDEX IF NOT EXISTS idx_chat_sessions_agent_id ON chat_sessions(agent_id)",
    "CREATE INDEX IF NOT EXISTS idx_chat_sessions_created ON chat_sessions(created_at)",
    "CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status)",
  ],
};

/**
 * 必須カラム定義
 */
export const CHAT_SESSIONS_REQUIRED_COLUMNS = ["status", "source"];
