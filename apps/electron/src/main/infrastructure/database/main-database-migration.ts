import { SqliteManager } from "./sqlite-manager";
import { Migration } from "@mcp_router/shared";

/**
 * データベースマイグレーション管理クラス
 * 全てのマイグレーションを一元管理
 */
export class MainDatabaseMigration {
  // 登録されたマイグレーションリスト（順序付き）
  private migrations: Migration[] = [];

  /**
   * コンストラクタ - マイグレーションを登録
   */
  public constructor(private db: SqliteManager) {
    // マイグレーションを実行順に登録
    this.registerMigrations();
  }

  /**
   * 実行すべき全てのマイグレーションを登録
   * 新しいマイグレーションを追加する場合はここに追加する
   */
  private registerMigrations(): void {
    // ServerRepository関連のマイグレーション
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

    // Projects feature (servers.project_id 列とインデックス)
    this.migrations.push({
      id: "20251101_projects_bootstrap",
      description: "Ensure servers.project_id column and index",
      execute: (db) => this.migrateProjectsBootstrap(db),
    });

    // トークンテーブルをメインDBに確実に作成
    this.migrations.push({
      id: "20250627_ensure_tokens_table_in_main_db",
      description:
        "Ensure tokens table exists in main database for workspace sharing",
      execute: (db) => this.migrateEnsureTokensTableInMainDb(db),
    });

    // Hooksテーブルを追加
    this.migrations.push({
      id: "20250805_add_hooks_table",
      description: "Add hooks table for MCP request/response hooks",
      execute: (db) => this.migrateAddHooksTable(db),
    });

    // Projects optimization カラムを追加
    this.migrations.push({
      id: "20260120_add_project_optimization_column",
      description: "Add optimization column to projects table",
      execute: (db) => this.migrateAddProjectOptimizationColumn(db),
    });

    // Agent paths テーブルを追加
    this.migrations.push({
      id: "20260124_add_agent_paths_table",
      description: "Add agent_paths table for custom symlink targets",
      execute: (db) => this.migrateAddAgentPathsTable(db),
    });
  }

  /**
   * 全てのマイグレーションを実行
   */
  public runMigrations(): void {
    try {
      const db = this.db;

      // マイグレーション管理テーブルの初期化
      this.initMigrationTable();

      // 実行済みマイグレーションを取得
      const completedMigrations = this.getCompletedMigrations();

      // 各マイグレーションを実行（実行済みのものはスキップ）
      for (const migration of this.migrations) {
        // 既に実行済みの場合はスキップ
        if (completedMigrations.has(migration.id)) {
          continue;
        }

        console.log(
          `Running migration ${migration.id}: ${migration.description}`,
        );

        try {
          // マイグレーションを実行（同期的に）
          migration.execute(db);

          // マイグレーションを完了としてマーク
          this.markMigrationComplete(migration.id);
        } catch (error) {
          throw error;
        }
      }
    } catch (error) {
      throw error;
    }
  }

  // ==========================================================================
  // Server Repository関連のマイグレーション
  // ==========================================================================

  /**
   * server_type列を追加するマイグレーション
   */
  private migrateAddServerTypeColumn(db: SqliteManager): void {
    try {
      // テーブルが存在するか確認
      const tableExists = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'servers'",
        {},
      );

      if (!tableExists) {
        console.log("servers table does not exist, skipping this migration");
        return;
      }

      // テーブル情報を取得
      const tableInfo = db.all("PRAGMA table_info(servers)");

      const columnNames = tableInfo.map((col: any) => col.name);

      // server_type列が存在しない場合は追加
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
   * remote_url列を追加するマイグレーション
   */
  private migrateAddRemoteUrlColumn(db: SqliteManager): void {
    try {
      // テーブルが存在するか確認
      const tableExists = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'servers'",
        {},
      );

      if (!tableExists) {
        console.log("servers table does not exist, skipping this migration");
        return;
      }

      // テーブル情報を取得
      const tableInfo = db.all("PRAGMA table_info(servers)");

      const columnNames = tableInfo.map((col: any) => col.name);

      // remote_url列が存在しない場合は追加
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
   * bearer_token列を追加するマイグレーション
   */
  private migrateAddBearerTokenColumn(db: SqliteManager): void {
    try {
      // テーブルが存在するか確認
      const tableExists = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'servers'",
        {},
      );

      if (!tableExists) {
        console.log("servers table does not exist, skipping this migration");
        return;
      }

      // テーブル情報を取得
      const tableInfo = db.all("PRAGMA table_info(servers)");

      const columnNames = tableInfo.map((col: any) => col.name);

      // bearer_token列が存在しない場合は追加
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
   * input_params列を追加するマイグレーション
   */
  private migrateAddInputParamsColumn(db: SqliteManager): void {
    try {
      // テーブルが存在するか確認
      const tableExists = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'servers'",
        {},
      );

      if (!tableExists) {
        console.log("servers table does not exist, skipping this migration");
        return;
      }

      // テーブル情報を取得
      const tableInfo = db.all("PRAGMA table_info(servers)");

      const columnNames = tableInfo.map((col: any) => col.name);

      // input_params列が存在しない場合は追加
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
   * description列を追加するマイグレーション
   */
  private migrateAddDescriptionColumn(db: SqliteManager): void {
    try {
      // テーブルが存在するか確認
      const tableExists = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'servers'",
        {},
      );

      if (!tableExists) {
        console.log("servers table does not exist, skipping this migration");
        return;
      }

      // テーブル情報を取得
      const tableInfo = db.all("PRAGMA table_info(servers)");

      const columnNames = tableInfo.map((col: any) => col.name);

      // description列が存在しない場合は追加
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
   * version列を追加するマイグレーション
   */
  private migrateAddVersionColumn(db: SqliteManager): void {
    try {
      // テーブルが存在するか確認
      const tableExists = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'servers'",
        {},
      );

      if (!tableExists) {
        console.log("servers table does not exist, skipping this migration");
        return;
      }

      // テーブル情報を取得
      const tableInfo = db.all("PRAGMA table_info(servers)");

      const columnNames = tableInfo.map((col: any) => col.name);

      // version列が存在しない場合は追加
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
   * latest_version列を追加するマイグレーション
   */
  private migrateAddLatestVersionColumn(db: SqliteManager): void {
    try {
      // テーブルが存在するか確認
      const tableExists = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'servers'",
        {},
      );

      if (!tableExists) {
        console.log("servers table does not exist, skipping this migration");
        return;
      }

      // テーブル情報を取得
      const tableInfo = db.all("PRAGMA table_info(servers)");

      const columnNames = tableInfo.map((col: any) => col.name);

      // latest_version列が存在しない場合は追加
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
   * verification_status列を追加するマイグレーション
   */
  private migrateAddVerificationStatusColumn(db: SqliteManager): void {
    try {
      // テーブルが存在するか確認
      const tableExists = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'servers'",
        {},
      );

      if (!tableExists) {
        console.log("servers table does not exist, skipping this migration");
        return;
      }

      // テーブル情報を取得
      const tableInfo = db.all("PRAGMA table_info(servers)");

      const columnNames = tableInfo.map((col: any) => col.name);

      // verification_status列が存在しない場合は追加
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
   * required_params列を追加するマイグレーション
   */
  private migrateAddRequiredParamsColumn(db: SqliteManager): void {
    try {
      // テーブルが存在するか確認
      const tableExists = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'servers'",
        {},
      );

      if (!tableExists) {
        console.log("servers table does not exist, skipping this migration");
        return;
      }

      // テーブル情報を取得
      const tableInfo = db.all("PRAGMA table_info(servers)");

      const columnNames = tableInfo.map((col: any) => col.name);

      // required_params列が存在しない場合は追加
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
   * tool_permissions列を追加するマイグレーション
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
   * トークンテーブルをメインDBに確実に作成するマイグレーション
   */
  private migrateEnsureTokensTableInMainDb(db: SqliteManager): void {
    try {
      // tokensテーブルの作成はTokenRepositoryで行うため、ここでは何もしない
      console.log("Creation of tokens table is delegated to TokenRepository");
    } catch (error) {
      console.error(
        "Error while ensuring tokens table in main database:",
        error,
      );
      throw error;
    }
  }

  // ==========================================================================
  // マイグレーション管理ユーティリティ
  // ==========================================================================

  /**
   * マイグレーション管理テーブルの初期化
   */
  private initMigrationTable(): void {
    const db = this.db;

    // マイグレーション管理テーブルの作成
    db.execute(`
      CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        executed_at INTEGER NOT NULL
      )
    `);
  }

  /**
   * 実行済みマイグレーションのリストを取得
   */
  private getCompletedMigrations(): Set<string> {
    const db = this.db;

    // 実行済みマイグレーションを取得
    const rows = db.all<{ id: string }>("SELECT id FROM migrations");

    // Set に変換して返す
    return new Set(rows.map((row: any) => row.id));
  }

  /**
   * マイグレーションを記録
   */
  private markMigrationComplete(migrationId: string): void {
    const db = this.db;

    // マイグレーションを記録
    db.execute(
      "INSERT INTO migrations (id, executed_at) VALUES (:id, :executedAt)",
      {
        id: migrationId,
        executedAt: Math.floor(Date.now() / 1000),
      },
    );
  }

  /**
   * hooksテーブルを追加するマイグレーション
   */
  private migrateAddHooksTable(db: SqliteManager): void {
    try {
      // HookRepositoryが初めて呼ばれた時に
      // テーブルが作成されるため、ここでは何もしない
      console.log("Creation of hooks table is delegated to HookRepository");
    } catch (error) {
      console.error("Error occurred during hooks table migration:", error);
      throw error;
    }
  }

  /**
   * Projects関連のマイグレーション整理:
   * - servers.project_id 列の追加（存在しなければ）
   * - servers(project_id) のインデックス作成（存在しなければ）
   *
   * 注意: projectsテーブルの作成はProjectRepository.initializeTable()に委譲
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
   * projects.optimization 列を追加するマイグレーション
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
   * agent_pathsテーブルを追加するマイグレーション
   * 標準エージェント5つを初期データとして挿入
   */
  private migrateAddAgentPathsTable(db: SqliteManager): void {
    try {
      // テーブル作成
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

      // 標準エージェントの初期データを挿入
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
}
