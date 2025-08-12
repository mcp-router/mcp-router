import { DatabaseTableSchema } from "@mcp_router/shared";

export const HOOKS_SCHEMA: DatabaseTableSchema = {
  createSQL: `
    CREATE TABLE IF NOT EXISTS hooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      execution_order INTEGER NOT NULL DEFAULT 0,
      hook_type TEXT NOT NULL CHECK(hook_type IN ('pre', 'post', 'both')),
      script TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `,
  indexes: [
    `CREATE INDEX IF NOT EXISTS idx_hooks_enabled ON hooks(enabled)`,
    `CREATE INDEX IF NOT EXISTS idx_hooks_execution_order ON hooks(execution_order)`,
    `CREATE INDEX IF NOT EXISTS idx_hooks_hook_type ON hooks(hook_type)`,
    `CREATE INDEX IF NOT EXISTS idx_hooks_created_at ON hooks(created_at)`,
  ],
};
