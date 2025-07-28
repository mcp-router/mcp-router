import { DatabaseTableSchema } from "@mcp_router/shared";

/**
 * エージェントテーブルのスキーマ定義
 */
export const AGENTS_SCHEMA: DatabaseTableSchema = {
  createSQL: `
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mcp_servers TEXT NOT NULL,
      tool_permissions TEXT NOT NULL DEFAULT '{}',
      purpose TEXT NOT NULL,
      instructions TEXT NOT NULL,
      description TEXT,
      auto_execute_tool INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      version TEXT NOT NULL DEFAULT '1.0.0',
      status TEXT NOT NULL DEFAULT 'development',
      tags TEXT NOT NULL DEFAULT '[]'
    )
  `,
  indexes: [
    "CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status)",
    "CREATE INDEX IF NOT EXISTS idx_agents_created ON agents(created_at)",
  ],
};

/**
 * 必須カラム定義
 */
export const AGENTS_REQUIRED_COLUMNS = [
  "mcp_servers",
  "tool_permissions",
  "purpose",
  "instructions",
];
