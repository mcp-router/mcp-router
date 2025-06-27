/**
 * 統一されたデータベーススキーマ定義
 * すべてのテーブル定義を一箇所で管理
 */

export interface TableSchema {
  createSQL: string;
  indexes?: string[];
}

/**
 * データベーススキーマ定義
 */
export const DATABASE_SCHEMA = {
  servers: {
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
  },

  agents: {
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
  },

  deployedAgents: {
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
  },

  requestLogs: {
    createSQL: `
      CREATE TABLE IF NOT EXISTS requestLogs (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        client_id TEXT NOT NULL,
        client_name TEXT NOT NULL,
        server_id TEXT NOT NULL,
        server_name TEXT NOT NULL,
        request_type TEXT NOT NULL,
        request_params TEXT,
        response_data TEXT,
        response_status TEXT NOT NULL,
        duration INTEGER NOT NULL,
        error_message TEXT
      )
    `,
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON requestLogs(timestamp)",
      "CREATE INDEX IF NOT EXISTS idx_request_logs_client_id ON requestLogs(client_id)",
      "CREATE INDEX IF NOT EXISTS idx_request_logs_server_id ON requestLogs(server_id)",
      "CREATE INDEX IF NOT EXISTS idx_request_logs_request_type ON requestLogs(request_type)",
      "CREATE INDEX IF NOT EXISTS idx_request_logs_response_status ON requestLogs(response_status)",
    ],
  },

  settings: {
    createSQL: `
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `,
    indexes: [],
  },

  chat_sessions: {
    createSQL: `
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        title TEXT,
        messages TEXT NOT NULL DEFAULT '[]',
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
        source TEXT NOT NULL DEFAULT 'ui'
      )
    `,
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_chat_sessions_agent_id ON chat_sessions(agent_id)",
      "CREATE INDEX IF NOT EXISTS idx_chat_sessions_created ON chat_sessions(createdAt)",
      "CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status)",
    ],
  },

  migrations: {
    createSQL: `
      CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        executed_at INTEGER NOT NULL
      )
    `,
    indexes: [],
  },
} as const;

/**
 * テーブル名の型定義
 */
export type TableName = keyof typeof DATABASE_SCHEMA;

/**
 * スキーマバージョン管理用の定数
 */
export const SCHEMA_VERSION = {
  // 各テーブルの最小必須カラム（これらがない場合は再作成が必要）
  REQUIRED_COLUMNS: {
    agents: ["mcp_servers", "tool_permissions", "purpose", "instructions"],
    deployedAgents: [
      "mcp_servers",
      "description",
      "purpose",
      "instructions",
      "tool_permissions",
    ],
    servers: ["server_type"],
    chat_sessions: ["status", "source"],
    requestLogs: [
      "client_id",
      "client_name",
      "server_id",
      "server_name",
      "request_type",
      "response_status",
    ],
  },
} as const;
