import { DatabaseTableSchema } from "@mcp_router/shared";

/**
 * ワークスペーステーブルのスキーマ定義
 */
export const WORKSPACES_SCHEMA: DatabaseTableSchema = {
  createSQL: `
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('local', 'remote')),
      isActive INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      lastUsedAt TEXT NOT NULL,
      localConfig TEXT,
      remoteConfig TEXT,
      displayInfo TEXT
    )
  `,
  indexes: [
    "CREATE INDEX IF NOT EXISTS idx_workspaces_active ON workspaces(isActive)",
    "CREATE INDEX IF NOT EXISTS idx_workspaces_type ON workspaces(type)",
    "CREATE INDEX IF NOT EXISTS idx_workspaces_last_used ON workspaces(lastUsedAt)",
  ],
};
