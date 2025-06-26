import { SqliteManager } from "./sqlite-manager";

/**
 * Workspace-specific database migration
 * Creates necessary tables for each workspace database
 */
export class WorkspaceDatabaseMigration {
  private db: SqliteManager;

  constructor(db: SqliteManager) {
    this.db = db;
  }

  /**
   * Run all migrations
   */
  public runMigrations(): void {
    try {
      // トランザクション内で全てのテーブルを作成
      this.db.transaction(() => {
        this.createServersTable();
        this.createAgentsTable();
        this.createDeployedAgentsTable();
        this.createLogsTable();
        this.createSettingsTable();
        this.createTokensTable();
        this.createChatSessionsTable();
        this.createMigrationsTable();
      });

      console.log("Workspace database initialization completed");
    } catch (error) {
      console.error("Failed to initialize workspace database:", error);
      throw error;
    }
  }

  /**
   * Create servers table
   */
  private createServersTable(): void {
    this.db.exec(`
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
      );

      CREATE INDEX IF NOT EXISTS idx_servers_name ON servers(name);
    `);
  }

  /**
   * Create agents table
   */
  private createAgentsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        version TEXT NOT NULL DEFAULT '1.0.0',
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'archived')),
        prompt TEXT NOT NULL,
        selectedServerIds TEXT NOT NULL DEFAULT '[]',
        selectedTools TEXT NOT NULL DEFAULT '[]',
        autoExecuteTool INTEGER NOT NULL DEFAULT 0,
        settings TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
      CREATE INDEX IF NOT EXISTS idx_agents_created ON agents(createdAt);
    `);
  }

  /**
   * Create deployed agents table
   */
  private createDeployedAgentsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS deployedAgents (
        id TEXT PRIMARY KEY,
        original_id TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL,
        description TEXT,
        version TEXT NOT NULL DEFAULT '1.0.0',
        prompt TEXT NOT NULL,
        selectedServerIds TEXT NOT NULL DEFAULT '[]',
        selectedTools TEXT NOT NULL DEFAULT '[]',
        autoExecuteTool INTEGER NOT NULL DEFAULT 0,
        mcp_server_enabled INTEGER DEFAULT 0,
        settings TEXT,
        deployedAt TEXT NOT NULL DEFAULT (datetime('now')),
        lastUsedAt TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_deployed_agents_deployed ON deployedAgents(deployedAt);
      CREATE INDEX IF NOT EXISTS idx_deployed_agents_last_used ON deployedAgents(lastUsedAt);
    `);
  }

  /**
   * Create logs table
   */
  private createLogsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        requestId TEXT NOT NULL,
        server_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        request TEXT NOT NULL,
        response TEXT,
        transport TEXT NOT NULL,
        duration INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_logs_server_id ON logs(server_id);
      CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_logs_request_id ON logs(requestId);
    `);
  }

  /**
   * Create settings table
   */
  private createSettingsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  /**
   * Create tokens table
   */
  private createTokensTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tokens (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        client_id TEXT NOT NULL,
        issued_at INTEGER NOT NULL,
        server_ids TEXT NOT NULL,
        scopes TEXT DEFAULT '[]'
      );

      CREATE INDEX IF NOT EXISTS idx_tokens_client_id ON tokens(client_id);
    `);
  }

  /**
   * Create chat sessions table
   */
  private createChatSessionsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        title TEXT,
        messages TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('active', 'completed', 'error')),
        source TEXT NOT NULL DEFAULT 'ui' CHECK(source IN ('ui', 'api', 'test')),
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_chat_sessions_agent_id ON chat_sessions(agent_id);
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_created ON chat_sessions(createdAt);
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status);
    `);
  }

  /**
   * Create migration management table
   */
  private createMigrationsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        executed_at INTEGER NOT NULL
      );
    `);
  }
}
