import { SqliteManager } from "./sqlite-manager";
import { Migration } from "@mcp_router/shared";

/**
 * Database migration management class.
 * Centrally manages all migrations.
 */
export class MainDatabaseMigration {
  // Registered migration list (ordered)
  private migrations: Migration[] = [];

  /**
   * Constructor - registers migrations
   */
  public constructor(private db: SqliteManager) {
    // Register migrations in execution order
    this.registerMigrations();
  }

  /**
   * Register all migrations to be executed.
   * Add new migrations here.
   */
  private registerMigrations(): void {
    // ServerRepository-related migrations
    this.migrations.push({
      id: "20250601_add_server_type_column",
      description: "Add server_type column to servers table",
      execute: (db) => this.migrateAddServerTypeColumn(db),
    });

    this.migrations.push({
      id: "20250602_add_remote_url_column",
      description: "Add remote_url column to servers table",
      execute: (db) => this.migrateAddRemoteUrlColumn(db),
    });

    this.migrations.push({
      id: "20250603_add_bearer_token_column",
      description: "Add bearer_token column to servers table",
      execute: (db) => this.migrateAddBearerTokenColumn(db),
    });

    this.migrations.push({
      id: "20250604_add_input_params_column",
      description: "Add input_params column to servers table",
      execute: (db) => this.migrateAddInputParamsColumn(db),
    });

    this.migrations.push({
      id: "20250605_add_description_column",
      description: "Add description column to servers table",
      execute: (db) => this.migrateAddDescriptionColumn(db),
    });

    this.migrations.push({
      id: "20250606_add_version_column",
      description: "Add version column to servers table",
      execute: (db) => this.migrateAddVersionColumn(db),
    });

    this.migrations.push({
      id: "20250607_add_latest_version_column",
      description: "Add latest_version column to servers table",
      execute: (db) => this.migrateAddLatestVersionColumn(db),
    });

    this.migrations.push({
      id: "20250608_add_verification_status_column",
      description: "Add verification_status column to servers table",
      execute: (db) => this.migrateAddVerificationStatusColumn(db),
    });

    this.migrations.push({
      id: "20250609_add_required_params_column",
      description: "Add required_params column to servers table",
      execute: (db) => this.migrateAddRequiredParamsColumn(db),
    });

    this.migrations.push({
      id: "20251210_add_tool_permissions_column",
      description: "Add tool_permissions column to servers table",
      execute: (db) => this.migrateAddToolPermissionsColumn(db),
    });

    // Projects feature (servers.project_id column and index)
    this.migrations.push({
      id: "20251101_projects_bootstrap",
      description: "Ensure servers.project_id column and index",
      execute: (db) => this.migrateProjectsBootstrap(db),
    });

    // Ensure tokens table exists in main DB
    this.migrations.push({
      id: "20250627_ensure_tokens_table_in_main_db",
      description:
        "Ensure tokens table exists in main database for workspace sharing",
      execute: (db) => this.migrateEnsureTokensTableInMainDb(db),
    });

    // Add hooks table
    this.migrations.push({
      id: "20250805_add_hooks_table",
      description: "Add hooks table for MCP request/response hooks",
      execute: (db) => this.migrateAddHooksTable(db),
    });

    // Add projects optimization column
    this.migrations.push({
      id: "20260120_add_project_optimization_column",
      description: "Add optimization column to projects table",
      execute: (db) => this.migrateAddProjectOptimizationColumn(db),
    });

    // Add agent paths table
    this.migrations.push({
      id: "20260124_add_agent_paths_table",
      description: "Add agent_paths table for custom symlink targets",
      execute: (db) => this.migrateAddAgentPathsTable(db),
    });

    // Dev column for hot reload configuration
    this.migrations.push({
      id: "20260130_add_dev_column",
      description: "Add dev column to servers table for hot reload config",
      execute: (db) => this.migrateAddDevColumn(db),
    });

    // Unified client_apps table
    this.migrations.push({
      id: "20260201_create_client_apps_table",
      description:
        "Create unified client_apps table and migrate agent_paths data",
      execute: (db) => this.migrateCreateClientAppsTable(db),
    });

    // Client skill states table for per-client skill state tracking
    this.migrations.push({
      id: "20260202_create_client_skill_states_table",
      description:
        "Create client_skill_states table for per-client skill state tracking",
      execute: (db) => this.migrateCreateClientSkillStatesTable(db),
    });
  }

  /**
   * Run all migrations
   */
  public runMigrations(): void {
    const db = this.db;

    // Initialize migration management table
    this.initMigrationTable();

    // Get completed migrations
    const completedMigrations = this.getCompletedMigrations();

    // Execute each migration (skip already completed ones)
    for (const migration of this.migrations) {
      // Skip if already executed
      if (completedMigrations.has(migration.id)) {
        continue;
      }

      console.log(
        `Running migration ${migration.id}: ${migration.description}`,
      );

      // Execute migration (synchronous)
      migration.execute(db);

      // Mark migration as complete
      this.markMigrationComplete(migration.id);
    }
  }

  // ==========================================================================
  // Server Repository related migrations
  // ==========================================================================

  /**
   * Migration to add the server_type column
   */
  private migrateAddServerTypeColumn(db: SqliteManager): void {
    try {
      // Check if table exists
      const tableExists = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'servers'",
        {},
      );

      if (!tableExists) {
        console.log("servers table does not exist, skipping this migration");
        return;
      }

      // Get table info
      const tableInfo = db.all("PRAGMA table_info(servers)");

      const columnNames = tableInfo.map((col: any) => col.name);

      // Add server_type column if it does not exist
      if (!columnNames.includes("server_type")) {
        console.log("Adding server_type column to servers");
        db.execute(
          "ALTER TABLE servers ADD COLUMN server_type TEXT NOT NULL DEFAULT 'local'",
        );
        console.log("server_type column added");
      } else {
        console.log("server_type column already exists, skipping");
      }
    } catch (error) {
      console.error("Error while adding server_type column:", error);
      throw error;
    }
  }

  /**
   * Migration to add the remote_url column
   */
  private migrateAddRemoteUrlColumn(db: SqliteManager): void {
    try {
      // Check if table exists
      const tableExists = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'servers'",
        {},
      );

      if (!tableExists) {
        console.log("servers table does not exist, skipping this migration");
        return;
      }

      // Get table info
      const tableInfo = db.all("PRAGMA table_info(servers)");

      const columnNames = tableInfo.map((col: any) => col.name);

      // Add remote_url column if it does not exist
      if (!columnNames.includes("remote_url")) {
        console.log("Adding remote_url column to servers");
        db.execute("ALTER TABLE servers ADD COLUMN remote_url TEXT");
        console.log("remote_url column added");
      } else {
        console.log("remote_url column already exists, skipping");
      }
    } catch (error) {
      console.error("Error while adding remote_url column:", error);
      throw error;
    }
  }

  /**
   * Migration to add the bearer_token column
   */
  private migrateAddBearerTokenColumn(db: SqliteManager): void {
    try {
      // Check if table exists
      const tableExists = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'servers'",
        {},
      );

      if (!tableExists) {
        console.log("servers table does not exist, skipping this migration");
        return;
      }

      // Get table info
      const tableInfo = db.all("PRAGMA table_info(servers)");

      const columnNames = tableInfo.map((col: any) => col.name);

      // Add bearer_token column if it does not exist
      if (!columnNames.includes("bearer_token")) {
        console.log("Adding bearer_token column to servers");
        db.execute("ALTER TABLE servers ADD COLUMN bearer_token TEXT");
        console.log("bearer_token column added");
      } else {
        console.log("bearer_token column already exists, skipping");
      }
    } catch (error) {
      console.error("Error while adding bearer_token column:", error);
      throw error;
    }
  }

  /**
   * Migration to add the input_params column
   */
  private migrateAddInputParamsColumn(db: SqliteManager): void {
    try {
      // Check if table exists
      const tableExists = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'servers'",
        {},
      );

      if (!tableExists) {
        console.log("servers table does not exist, skipping this migration");
        return;
      }

      // Get table info
      const tableInfo = db.all("PRAGMA table_info(servers)");

      const columnNames = tableInfo.map((col: any) => col.name);

      // Add input_params column if it does not exist
      if (!columnNames.includes("input_params")) {
        console.log("Adding input_params column to servers");
        db.execute("ALTER TABLE servers ADD COLUMN input_params TEXT");
        console.log("input_params column added");
      } else {
        console.log("input_params column already exists, skipping");
      }
    } catch (error) {
      console.error("Error while adding input_params column:", error);
      throw error;
    }
  }

  /**
   * Migration to add the description column
   */
  private migrateAddDescriptionColumn(db: SqliteManager): void {
    try {
      // Check if table exists
      const tableExists = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'servers'",
        {},
      );

      if (!tableExists) {
        console.log("servers table does not exist, skipping this migration");
        return;
      }

      // Get table info
      const tableInfo = db.all("PRAGMA table_info(servers)");

      const columnNames = tableInfo.map((col: any) => col.name);

      // Add description column if it does not exist
      if (!columnNames.includes("description")) {
        console.log("Adding description column to servers");
        db.execute("ALTER TABLE servers ADD COLUMN description TEXT");
        console.log("description column added");
      } else {
        console.log("description column already exists, skipping");
      }
    } catch (error) {
      console.error("Error while adding description column:", error);
      throw error;
    }
  }

  /**
   * Migration to add the version column
   */
  private migrateAddVersionColumn(db: SqliteManager): void {
    try {
      // Check if table exists
      const tableExists = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'servers'",
        {},
      );

      if (!tableExists) {
        console.log("servers table does not exist, skipping this migration");
        return;
      }

      // Get table info
      const tableInfo = db.all("PRAGMA table_info(servers)");

      const columnNames = tableInfo.map((col: any) => col.name);

      // Add version column if it does not exist
      if (!columnNames.includes("version")) {
        console.log("Adding version column to servers");
        db.execute("ALTER TABLE servers ADD COLUMN version TEXT");
        console.log("version column added");
      } else {
        console.log("version column already exists, skipping");
      }
    } catch (error) {
      console.error("Error while adding version column:", error);
      throw error;
    }
  }

  /**
   * Migration to add the latest_version column
   */
  private migrateAddLatestVersionColumn(db: SqliteManager): void {
    try {
      // Check if table exists
      const tableExists = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'servers'",
        {},
      );

      if (!tableExists) {
        console.log("servers table does not exist, skipping this migration");
        return;
      }

      // Get table info
      const tableInfo = db.all("PRAGMA table_info(servers)");

      const columnNames = tableInfo.map((col: any) => col.name);

      // Add latest_version column if it does not exist
      if (!columnNames.includes("latest_version")) {
        console.log("Adding latest_version column to servers");
        db.execute("ALTER TABLE servers ADD COLUMN latest_version TEXT");
        console.log("latest_version column added");
      } else {
        console.log("latest_version column already exists, skipping");
      }
    } catch (error) {
      console.error("Error while adding latest_version column:", error);
      throw error;
    }
  }

  /**
   * Migration to add the verification_status column
   */
  private migrateAddVerificationStatusColumn(db: SqliteManager): void {
    try {
      // Check if table exists
      const tableExists = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'servers'",
        {},
      );

      if (!tableExists) {
        console.log("servers table does not exist, skipping this migration");
        return;
      }

      // Get table info
      const tableInfo = db.all("PRAGMA table_info(servers)");

      const columnNames = tableInfo.map((col: any) => col.name);

      // Add verification_status column if it does not exist
      if (!columnNames.includes("verification_status")) {
        console.log("Adding verification_status column to servers");
        db.execute("ALTER TABLE servers ADD COLUMN verification_status TEXT");
        console.log("verification_status column added");
      } else {
        console.log("verification_status column already exists, skipping");
      }
    } catch (error) {
      console.error("Error while adding verification_status column:", error);
      throw error;
    }
  }

  /**
   * Migration to add the required_params column
   */
  private migrateAddRequiredParamsColumn(db: SqliteManager): void {
    try {
      // Check if table exists
      const tableExists = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'servers'",
        {},
      );

      if (!tableExists) {
        console.log("servers table does not exist, skipping this migration");
        return;
      }

      // Get table info
      const tableInfo = db.all("PRAGMA table_info(servers)");

      const columnNames = tableInfo.map((col: any) => col.name);

      // Add required_params column if it does not exist
      if (!columnNames.includes("required_params")) {
        console.log("Adding required_params column to servers");
        db.execute("ALTER TABLE servers ADD COLUMN required_params TEXT");
        console.log("required_params column added");
      } else {
        console.log("required_params column already exists, skipping");
      }
    } catch (error) {
      console.error("Error while adding required_params column:", error);
      throw error;
    }
  }

  /**
   * Migration to add the tool_permissions column
   */
  private migrateAddToolPermissionsColumn(db: SqliteManager): void {
    try {
      const tableExists = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'servers'",
        {},
      );

      if (!tableExists) {
        console.log("servers table does not exist, skipping this migration");
        return;
      }

      const tableInfo = db.all("PRAGMA table_info(servers)");
      const columnNames = tableInfo.map((col: any) => col.name);

      if (!columnNames.includes("tool_permissions")) {
        console.log("Adding tool_permissions column to servers");
        db.execute("ALTER TABLE servers ADD COLUMN tool_permissions TEXT");
        console.log("tool_permissions column added");
      } else {
        console.log("tool_permissions column already exists, skipping");
      }
    } catch (error) {
      console.error("Error while adding tool_permissions column:", error);
      throw error;
    }
  }

  /**
   * Migration to ensure tokens table exists in main DB
   */
  private migrateEnsureTokensTableInMainDb(_db: SqliteManager): void {
    // Tokens table creation is delegated to TokenRepository
    console.log("Creation of tokens table is delegated to TokenRepository");
  }

  // ==========================================================================
  // Migration management utilities
  // ==========================================================================

  /**
   * Initialize the migration management table
   */
  private initMigrationTable(): void {
    const db = this.db;

    // Create migration management table
    db.execute(`
      CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        executed_at INTEGER NOT NULL
      )
    `);
  }

  /**
   * Get the list of completed migrations
   */
  private getCompletedMigrations(): Set<string> {
    const db = this.db;

    // Get completed migrations
    const rows = db.all<{ id: string }>("SELECT id FROM migrations");

    // Convert to Set and return
    return new Set(rows.map((row: any) => row.id));
  }

  /**
   * Record a migration as complete
   */
  private markMigrationComplete(migrationId: string): void {
    const db = this.db;

    // Record migration
    db.execute(
      "INSERT INTO migrations (id, executed_at) VALUES (:id, :executedAt)",
      {
        id: migrationId,
        executedAt: Math.floor(Date.now() / 1000),
      },
    );
  }

  /**
   * Migration to add the hooks table
   */
  private migrateAddHooksTable(_db: SqliteManager): void {
    // Table is created when HookRepository is first called
    console.log("Creation of hooks table is delegated to HookRepository");
  }

  /**
   * Projects-related migration:
   * - Add servers.project_id column (if not exists)
   * - Create index on servers(project_id) (if not exists)
   *
   * Note: projects table creation is delegated to ProjectRepository.initializeTable()
   */
  private migrateProjectsBootstrap(db: SqliteManager): void {
    try {
      // Ensure servers.project_id exists
      const serversTable = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'servers'",
        {},
      );
      if (serversTable) {
        const tableInfo = db.all("PRAGMA table_info(servers)");
        const columnNames = tableInfo.map((col: any) => col.name);
        if (!columnNames.includes("project_id")) {
          db.execute("ALTER TABLE servers ADD COLUMN project_id TEXT");
        }

        // Ensure index on servers(project_id)
        db.execute(
          "CREATE INDEX IF NOT EXISTS idx_servers_project_id ON servers(project_id)",
        );
      }
    } catch (error) {
      console.error("Error while ensuring servers.project_id:", error);
      throw error;
    }
  }

  /**
   * Migration to add the projects.optimization column
   */
  private migrateAddProjectOptimizationColumn(db: SqliteManager): void {
    try {
      const tableExists = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'projects'",
        {},
      );

      if (!tableExists) {
        console.log("projects table does not exist, skipping this migration");
        return;
      }

      const tableInfo = db.all("PRAGMA table_info(projects)");
      const columnNames = tableInfo.map((col: any) => col.name);

      if (!columnNames.includes("optimization")) {
        console.log("Adding optimization column to projects");
        db.execute("ALTER TABLE projects ADD COLUMN optimization TEXT");
        console.log("optimization column added");
      } else {
        console.log("optimization column already exists, skipping");
      }
    } catch (error) {
      console.error("Error while adding optimization column:", error);
      throw error;
    }
  }

  /**
   * Migration to add the agent_paths table.
   * Inserts 5 standard agents as initial data.
   */
  private migrateAddAgentPathsTable(db: SqliteManager): void {
    try {
      // Create table
      db.execute(`
        CREATE TABLE IF NOT EXISTS agent_paths (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          path TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);
      console.log("agent_paths table created");

      // Insert default agent data
      const now = Date.now();
      const defaultAgents = [
        { name: "claude-code", path: "~/.claude/skills" },
        { name: "codex", path: "~/.codex/skills" },
        { name: "copilot", path: "~/.copilot/skills" },
        { name: "cline", path: "~/.cline/skills" },
        { name: "opencode", path: "~/.config/opencode/skill" },
      ];

      for (const agent of defaultAgents) {
        const id = crypto.randomUUID();
        db.execute(
          `INSERT OR IGNORE INTO agent_paths (id, name, path, created_at, updated_at)
           VALUES (:id, :name, :path, :createdAt, :updatedAt)`,
          {
            id,
            name: agent.name,
            path: agent.path,
            createdAt: now,
            updatedAt: now,
          },
        );
      }
      console.log("Default agent paths inserted");
    } catch (error) {
      console.error("Error while creating agent_paths table:", error);
      throw error;
    }
  }

  /**
   * Migration to add the dev column (for hot reload configuration)
   */
  private migrateAddDevColumn(db: SqliteManager): void {
    try {
      const tableExists = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'servers'",
        {},
      );

      if (!tableExists) {
        console.log("servers table does not exist, skipping this migration");
        return;
      }

      const tableInfo = db.all("PRAGMA table_info(servers)");
      const columnNames = tableInfo.map((col: any) => col.name);

      if (!columnNames.includes("dev")) {
        console.log("Adding dev column to servers");
        db.execute("ALTER TABLE servers ADD COLUMN dev TEXT");
        console.log("dev column added");
      } else {
        console.log("dev column already exists, skipping");
      }
    } catch (error) {
      console.error("Error while adding dev column:", error);
      throw error;
    }
  }

  /**
   * Migration to create the client_apps table and migrate data from agent_paths
   */
  private migrateCreateClientAppsTable(db: SqliteManager): void {
    try {
      // Create the unified client_apps table with all columns expected by ClientAppRepository
      db.execute(`
        CREATE TABLE IF NOT EXISTS client_apps (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          icon TEXT,
          installed INTEGER NOT NULL DEFAULT 0,
          mcp_config_path TEXT NOT NULL,
          mcp_configured INTEGER NOT NULL DEFAULT 0,
          has_other_mcp_servers INTEGER NOT NULL DEFAULT 0,
          skills_path TEXT NOT NULL,
          skills_configured INTEGER NOT NULL DEFAULT 0,
          server_access TEXT NOT NULL DEFAULT '{}',
          token TEXT,
          is_standard INTEGER NOT NULL DEFAULT 0,
          is_custom INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);
      console.log("client_apps table created");

      // Check if agent_paths table exists and migrate data
      const agentPathsExists = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'agent_paths'",
        {},
      );

      if (agentPathsExists) {
        // Get all records from agent_paths
        const agentPaths = db.all<{
          id: string;
          name: string;
          path: string;
          created_at: number;
          updated_at: number;
        }>("SELECT * FROM agent_paths");

        console.log(
          `Migrating ${agentPaths.length} records from agent_paths to client_apps`,
        );

        // Migrate each record to client_apps
        for (const agentPath of agentPaths) {
          db.execute(
            `INSERT OR IGNORE INTO client_apps
             (id, name, icon, installed, mcp_config_path, mcp_configured, has_other_mcp_servers, skills_path, skills_configured, server_access, token, is_standard, is_custom, created_at, updated_at)
             VALUES (:id, :name, :icon, :installed, :mcpConfigPath, :mcpConfigured, :hasOtherMcpServers, :skillsPath, :skillsConfigured, :serverAccess, :token, :isStandard, :isCustom, :createdAt, :updatedAt)`,
            {
              id: agentPath.id,
              name: agentPath.name,
              icon: null,
              installed: 0,
              mcpConfigPath: "",
              mcpConfigured: 0,
              hasOtherMcpServers: 0,
              skillsPath: agentPath.path,
              skillsConfigured: 0,
              serverAccess: "{}",
              token: null,
              isStandard: 0,
              isCustom: 1,
              createdAt: agentPath.created_at,
              updatedAt: agentPath.updated_at,
            },
          );
        }
        console.log("Data migrated from agent_paths to client_apps");
      } else {
        console.log(
          "agent_paths table does not exist, skipping data migration",
        );
      }
    } catch (error) {
      console.error("Error while creating client_apps table:", error);
      throw error;
    }
  }

  /**
   * Migration to create the client_skill_states table.
   * Junction table for tracking state between skills and clients.
   */
  private migrateCreateClientSkillStatesTable(db: SqliteManager): void {
    try {
      // Create the client_skill_states table
      db.execute(`
        CREATE TABLE IF NOT EXISTS client_skill_states (
          id TEXT PRIMARY KEY,
          skill_id TEXT NOT NULL,
          client_id TEXT NOT NULL,
          state TEXT NOT NULL DEFAULT 'not-installed',
          is_managed INTEGER NOT NULL DEFAULT 0,
          source_type TEXT,
          discovered_path TEXT,
          symlink_status TEXT DEFAULT 'none',
          last_sync_at INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          UNIQUE(skill_id, client_id)
        )
      `);
      console.log("client_skill_states table created");

      // Create indexes for efficient lookups
      db.execute(
        "CREATE INDEX IF NOT EXISTS idx_client_skill_states_skill ON client_skill_states(skill_id)",
      );
      console.log("idx_client_skill_states_skill index created");

      db.execute(
        "CREATE INDEX IF NOT EXISTS idx_client_skill_states_client ON client_skill_states(client_id)",
      );
      console.log("idx_client_skill_states_client index created");
    } catch (error) {
      console.error("Error while creating client_skill_states table:", error);
      throw error;
    }
  }
}
