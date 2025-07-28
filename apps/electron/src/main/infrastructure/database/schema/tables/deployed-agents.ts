import { DatabaseTableSchema } from "@mcp_router/shared";

/**
 * デプロイ済みエージェントテーブルのスキーマ定義
 */
export const DEPLOYED_AGENTS_SCHEMA: DatabaseTableSchema = {
  createSQL: `
    CREATE TABLE IF NOT EXISTS deployedAgents (
      id TEXT PRIMARY KEY,
      original_id TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      mcp_servers TEXT NOT NULL,
      purpose TEXT NOT NULL,
      instructions TEXT NOT NULL,
      tool_permissions TEXT NOT NULL DEFAULT '{}',
      auto_execute_tool INTEGER NOT NULL DEFAULT 0,
      mcp_server_enabled INTEGER DEFAULT 0,
      tags TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'development',
      deployed_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      deployment_config TEXT,
      last_used_at TEXT,
      user_id TEXT
    )
  `,
  indexes: [
    "CREATE INDEX IF NOT EXISTS idx_deployed_agents_deployed ON deployedAgents(deployed_at)",
    "CREATE INDEX IF NOT EXISTS idx_deployed_agents_last_used ON deployedAgents(last_used_at)",
    "CREATE INDEX IF NOT EXISTS idx_deployed_agents_status ON deployedAgents(status)",
  ],
};

/**
 * 必須カラム定義
 */
export const DEPLOYED_AGENTS_REQUIRED_COLUMNS = [
  "mcp_servers",
  "description",
  "purpose",
  "instructions",
  "tool_permissions",
];
