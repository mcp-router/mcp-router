import { getSqliteManager, SqliteManager } from "./sqlite-manager";
import { getServerRepository } from "./server-repository";
import { TokenScope } from "@mcp-router/shared";
import { safeStorage } from "electron";

/**
 * Migration interface defining structure for each migration
 */
interface Migration {
  id: string; // Unique migration identifier (e.g., "20250511_add_scopes_to_tokens")
  description: string; // Human-readable description of what the migration does
  execute: (db: SqliteManager) => void; // Function to execute the migration (synchronous)
}

/**
 * データベースマイグレーション管理クラス
 * 全てのマイグレーションを一元管理
 */
export class DatabaseMigration {
  private static instance: DatabaseMigration | null = null;
  // 登録されたマイグレーションリスト（順序付き）
  private migrations: Migration[] = [];

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): DatabaseMigration {
    if (!DatabaseMigration.instance) {
      DatabaseMigration.instance = new DatabaseMigration();
    }
    return DatabaseMigration.instance;
  }

  /**
   * コンストラクタ - マイグレーションを登録
   */
  private constructor() {
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

    // AgentRepository関連のマイグレーション: エージェントテーブルの管理
    this.migrations.push({
      id: "20250526_agent_table_management",
      description:
        "Manage agent tables: drop for reinitialization and add auto_execute_tool column to deployedAgents",
      execute: (db) => this.migrateAgentTableManagement(db),
    });

    // TokenRepository関連のマイグレーション
    this.migrations.push({
      id: "20250511_add_scopes_to_tokens",
      description:
        "Add scopes column to tokens table and populate with default scopes",
      execute: (db) => this.migrateTokensAddScopes(db),
    });

    // データ暗号化マイグレーション
    this.migrations.push({
      id: "20250513_encrypt_server_data",
      description: "Encrypt server sensitive data",
      execute: (db) => this.migrateToEncryption(db),
    });

    // DeployedAgent original_id カラム追加
    this.migrations.push({
      id: "20250602_add_original_id_to_deployed_agents",
      description: "Add original_id column to deployedAgents table",
      execute: (db) => this.migrateAddOriginalIdToDeployedAgents(db),
    });

    // DeployedAgent mcp_server_enabled カラム追加
    this.migrations.push({
      id: "20250610_add_mcp_server_enabled_to_deployed_agents",
      description: "Add mcp_server_enabled column to deployedAgents table",
      execute: (db) => this.migrateAddMcpServerEnabledToDeployedAgents(db),
    });

    // ChatSessions テーブルの更新: status/source追加
    this.migrations.push({
      id: "20250614_update_chat_sessions_schema",
      description: "Update chat_sessions table: add status/source columns",
      execute: (db) => this.migrateUpdateChatSessionsSchema(db),
    });


    // トークンテーブルをメインDBに確実に作成
    this.migrations.push({
      id: "20250627_ensure_tokens_table_in_main_db",
      description: "Ensure tokens table exists in main database for workspace sharing",
      execute: (db) => this.migrateEnsureTokensTableInMainDb(db),
    });
  }

  /**
   * 全てのマイグレーションを実行
   */
  public runMigrations(): void {
    try {
      const db = getSqliteManager();

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
          `マイグレーション ${migration.id} を実行中: ${migration.description}`,
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
        console.log(
          "serversテーブルが存在しないため、このマイグレーションをスキップします",
        );
        return;
      }

      // テーブル情報を取得
      const tableInfo = db.all("PRAGMA table_info(servers)");

      const columnNames = tableInfo.map((col: any) => col.name);

      // server_type列が存在しない場合は追加
      if (!columnNames.includes("server_type")) {
        console.log("serversテーブルにserver_type列を追加します");
        db.execute(
          "ALTER TABLE servers ADD COLUMN server_type TEXT NOT NULL DEFAULT 'local'",
        );
        console.log("server_type列の追加が完了しました");
      } else {
        console.log("server_type列は既に存在するため、追加をスキップします");
      }
    } catch (error) {
      console.error("server_type列の追加中にエラーが発生しました:", error);
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
        console.log(
          "serversテーブルが存在しないため、このマイグレーションをスキップします",
        );
        return;
      }

      // テーブル情報を取得
      const tableInfo = db.all("PRAGMA table_info(servers)");

      const columnNames = tableInfo.map((col: any) => col.name);

      // remote_url列が存在しない場合は追加
      if (!columnNames.includes("remote_url")) {
        console.log("serversテーブルにremote_url列を追加します");
        db.execute("ALTER TABLE servers ADD COLUMN remote_url TEXT");
        console.log("remote_url列の追加が完了しました");
      } else {
        console.log("remote_url列は既に存在するため、追加をスキップします");
      }
    } catch (error) {
      console.error("remote_url列の追加中にエラーが発生しました:", error);
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
        console.log(
          "serversテーブルが存在しないため、このマイグレーションをスキップします",
        );
        return;
      }

      // テーブル情報を取得
      const tableInfo = db.all("PRAGMA table_info(servers)");

      const columnNames = tableInfo.map((col: any) => col.name);

      // bearer_token列が存在しない場合は追加
      if (!columnNames.includes("bearer_token")) {
        console.log("serversテーブルにbearer_token列を追加します");
        db.execute("ALTER TABLE servers ADD COLUMN bearer_token TEXT");
        console.log("bearer_token列の追加が完了しました");
      } else {
        console.log("bearer_token列は既に存在するため、追加をスキップします");
      }
    } catch (error) {
      console.error("bearer_token列の追加中にエラーが発生しました:", error);
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
        console.log(
          "serversテーブルが存在しないため、このマイグレーションをスキップします",
        );
        return;
      }

      // テーブル情報を取得
      const tableInfo = db.all("PRAGMA table_info(servers)");

      const columnNames = tableInfo.map((col: any) => col.name);

      // input_params列が存在しない場合は追加
      if (!columnNames.includes("input_params")) {
        console.log("serversテーブルにinput_params列を追加します");
        db.execute("ALTER TABLE servers ADD COLUMN input_params TEXT");
        console.log("input_params列の追加が完了しました");
      } else {
        console.log("input_params列は既に存在するため、追加をスキップします");
      }
    } catch (error) {
      console.error("input_params列の追加中にエラーが発生しました:", error);
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
        console.log(
          "serversテーブルが存在しないため、このマイグレーションをスキップします",
        );
        return;
      }

      // テーブル情報を取得
      const tableInfo = db.all("PRAGMA table_info(servers)");

      const columnNames = tableInfo.map((col: any) => col.name);

      // description列が存在しない場合は追加
      if (!columnNames.includes("description")) {
        console.log("serversテーブルにdescription列を追加します");
        db.execute("ALTER TABLE servers ADD COLUMN description TEXT");
        console.log("description列の追加が完了しました");
      } else {
        console.log("description列は既に存在するため、追加をスキップします");
      }
    } catch (error) {
      console.error("description列の追加中にエラーが発生しました:", error);
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
        console.log(
          "serversテーブルが存在しないため、このマイグレーションをスキップします",
        );
        return;
      }

      // テーブル情報を取得
      const tableInfo = db.all("PRAGMA table_info(servers)");

      const columnNames = tableInfo.map((col: any) => col.name);

      // version列が存在しない場合は追加
      if (!columnNames.includes("version")) {
        console.log("serversテーブルにversion列を追加します");
        db.execute("ALTER TABLE servers ADD COLUMN version TEXT");
        console.log("version列の追加が完了しました");
      } else {
        console.log("version列は既に存在するため、追加をスキップします");
      }
    } catch (error) {
      console.error("version列の追加中にエラーが発生しました:", error);
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
        console.log(
          "serversテーブルが存在しないため、このマイグレーションをスキップします",
        );
        return;
      }

      // テーブル情報を取得
      const tableInfo = db.all("PRAGMA table_info(servers)");

      const columnNames = tableInfo.map((col: any) => col.name);

      // latest_version列が存在しない場合は追加
      if (!columnNames.includes("latest_version")) {
        console.log("serversテーブルにlatest_version列を追加します");
        db.execute("ALTER TABLE servers ADD COLUMN latest_version TEXT");
        console.log("latest_version列の追加が完了しました");
      } else {
        console.log("latest_version列は既に存在するため、追加をスキップします");
      }
    } catch (error) {
      console.error("latest_version列の追加中にエラーが発生しました:", error);
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
        console.log(
          "serversテーブルが存在しないため、このマイグレーションをスキップします",
        );
        return;
      }

      // テーブル情報を取得
      const tableInfo = db.all("PRAGMA table_info(servers)");

      const columnNames = tableInfo.map((col: any) => col.name);

      // verification_status列が存在しない場合は追加
      if (!columnNames.includes("verification_status")) {
        console.log("serversテーブルにverification_status列を追加します");
        db.execute("ALTER TABLE servers ADD COLUMN verification_status TEXT");
        console.log("verification_status列の追加が完了しました");
      } else {
        console.log(
          "verification_status列は既に存在するため、追加をスキップします",
        );
      }
    } catch (error) {
      console.error(
        "verification_status列の追加中にエラーが発生しました:",
        error,
      );
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
        console.log(
          "serversテーブルが存在しないため、このマイグレーションをスキップします",
        );
        return;
      }

      // テーブル情報を取得
      const tableInfo = db.all("PRAGMA table_info(servers)");

      const columnNames = tableInfo.map((col: any) => col.name);

      // required_params列が存在しない場合は追加
      if (!columnNames.includes("required_params")) {
        console.log("serversテーブルにrequired_params列を追加します");
        db.execute("ALTER TABLE servers ADD COLUMN required_params TEXT");
        console.log("required_params列の追加が完了しました");
      } else {
        console.log(
          "required_params列は既に存在するため、追加をスキップします",
        );
      }
    } catch (error) {
      console.error("required_params列の追加中にエラーが発生しました:", error);
      throw error;
    }
  }

  // ==========================================================================
  // Token Repository関連のマイグレーション
  // ==========================================================================

  /**
   * トークンテーブルにスコープカラムを追加するマイグレーション
   */
  private migrateTokensAddScopes(db: SqliteManager): void {
    try {
      // テーブルが存在するか確認
      const tableExists = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'tokens'",
        {},
      );

      if (!tableExists) {
        console.log(
          "tokensテーブルが存在しないため、このマイグレーションをスキップします",
        );
        return;
      }

      // スコープカラムがまだ存在しない場合は追加
      db.transaction(() => {
        // テーブル情報を取得
        const tableInfo = db.all("PRAGMA table_info(tokens)");

        // スコープカラムが存在しない場合は追加
        if (!tableInfo.some((column: any) => column.name === "scopes")) {
          db.execute("ALTER TABLE tokens ADD COLUMN scopes TEXT DEFAULT '[]'");
          console.log("トークンテーブルにスコープカラムを追加しました");
        } else {
          console.log("scopesカラムは既に存在するため、追加をスキップします");
          return;
        }

        // 既存のトークンに全スコープを付与
        const scopesJson = JSON.stringify([
          TokenScope.MCP_SERVER_MANAGEMENT,
          TokenScope.LOG_MANAGEMENT,
          TokenScope.APPLICATION,
        ]);

        db.execute(
          "UPDATE tokens SET scopes = :scopes WHERE scopes IS NULL OR scopes = '[]'",
          { scopes: scopesJson },
        );

        console.log("既存のトークンに全スコープを付与しました");
      });
    } catch (error) {
      console.error(
        "トークンテーブルのスコープカラム追加中にエラーが発生しました:",
        error,
      );
      throw error;
    }
  }

  /**
   * エージェントテーブル管理の統合マイグレーション
   * - agentsテーブルとdeployedAgentsテーブルを削除して再初期化を可能にする
   * - deployedAgentsテーブルにauto_execute_tool列を追加する
   */
  private migrateAgentTableManagement(db: SqliteManager): void {
    try {
      // 既存のagentsテーブルとdeployedAgentsテーブルを削除
      const agentsTableExists = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'agents'",
        {},
      );

      const deployedAgentsTableExists = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'deployedAgents'",
        {},
      );

      if (agentsTableExists || deployedAgentsTableExists) {
        console.log("既存のエージェントテーブルを削除します");
        db.execute("DROP TABLE IF EXISTS agents");
        db.execute("DROP TABLE IF EXISTS deployedAgents");
        console.log(
          "エージェントテーブルの削除が完了しました。次回のアプリケーション起動時にAgentRepositoryによって再作成されます。",
        );
      } else {
        console.log(
          "エージェントテーブルが存在しないため、削除処理をスキップします",
        );
      }

      // 注意: auto_execute_tool列の追加は、テーブルが再作成される際に
      // AgentRepositoryのスキーマ定義に含まれるため、ここでは不要
      console.log("エージェントテーブル管理マイグレーションが完了しました");
    } catch (error) {
      console.error(
        "エージェントテーブル管理マイグレーション中にエラーが発生しました:",
        error,
      );
      throw error;
    }
  }

  /**
   * deployedAgentsテーブルにoriginal_id列を追加するマイグレーション
   */
  private migrateAddOriginalIdToDeployedAgents(db: SqliteManager): void {
    try {
      // テーブルが存在するか確認
      const tableExists = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'deployedAgents'",
        {},
      );

      if (!tableExists) {
        console.log(
          "deployedAgentsテーブルが存在しないため、このマイグレーションをスキップします",
        );
        return;
      }

      // テーブル情報を取得
      const tableInfo = db.all("PRAGMA table_info(deployedAgents)");

      const columnNames = tableInfo.map((col: any) => col.name);

      // original_id列が存在しない場合は追加
      if (!columnNames.includes("original_id")) {
        console.log("deployedAgentsテーブルにoriginal_id列を追加します");
        db.execute(
          "ALTER TABLE deployedAgents ADD COLUMN original_id TEXT NOT NULL DEFAULT ''",
        );
        console.log("original_id列の追加が完了しました");
      } else {
        console.log("original_id列は既に存在するため、追加をスキップします");
      }
    } catch (error) {
      console.error("original_id列の追加中にエラーが発生しました:", error);
      throw error;
    }
  }

  /**
   * deployedAgentsテーブルにmcp_server_enabled列を追加するマイグレーション
   */
  private migrateAddMcpServerEnabledToDeployedAgents(db: SqliteManager): void {
    try {
      // テーブルが存在するか確認
      const tableExists = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'deployedAgents'",
        {},
      );

      if (!tableExists) {
        console.log(
          "deployedAgentsテーブルが存在しないため、このマイグレーションをスキップします",
        );
        return;
      }

      // テーブル情報を取得
      const tableInfo = db.all("PRAGMA table_info(deployedAgents)");

      const columnNames = tableInfo.map((col: any) => col.name);

      // mcp_server_enabled列が存在しない場合は追加
      if (!columnNames.includes("mcp_server_enabled")) {
        console.log("deployedAgentsテーブルにmcp_server_enabled列を追加します");
        db.execute(
          "ALTER TABLE deployedAgents ADD COLUMN mcp_server_enabled INTEGER DEFAULT 0",
        );
        console.log("mcp_server_enabled列の追加が完了しました");
      } else {
        console.log(
          "mcp_server_enabled列は既に存在するため、追加をスキップします",
        );
      }
    } catch (error) {
      console.error(
        "mcp_server_enabled列の追加中にエラーが発生しました:",
        error,
      );
      throw error;
    }
  }

  /**
   * chat_sessionsテーブルのスキーマを更新するマイグレーション
   * - status列とsource列を追加
   */
  private migrateUpdateChatSessionsSchema(db: SqliteManager): void {
    try {
      // テーブルが存在するか確認
      const tableExists = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'chat_sessions'",
        {},
      );

      if (!tableExists) {
        return;
      }

      // テーブル情報を取得
      const tableInfo = db.all("PRAGMA table_info(chat_sessions)");

      const columnNames = tableInfo.map((col: any) => col.name);

      // status列が存在しない場合は追加
      if (!columnNames.includes("status")) {
        db.execute(
          "ALTER TABLE chat_sessions ADD COLUMN status TEXT NOT NULL DEFAULT 'completed'",
        );
      }
      // source列が存在しない場合は追加
      if (!columnNames.includes("source")) {
        db.execute(
          "ALTER TABLE chat_sessions ADD COLUMN source TEXT NOT NULL DEFAULT 'ui'",
        );
      }

      // statusインデックスが存在しない場合は作成
      db.execute(
        "CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status)",
      );
    } catch (error) {
      console.error(
        "chat_sessionsテーブルのスキーマ更新中にエラーが発生しました:",
        error,
      );
      throw error;
    }
  }


  /**
   * トークンテーブルをメインDBに確実に作成するマイグレーション
   */
  private migrateEnsureTokensTableInMainDb(db: SqliteManager): void {
    try {
      // tokensテーブルの作成（存在しない場合）
      db.execute(`
        CREATE TABLE IF NOT EXISTS tokens (
          id TEXT PRIMARY KEY,
          client_id TEXT NOT NULL,
          issued_at INTEGER NOT NULL,
          server_ids TEXT NOT NULL,
          scopes TEXT DEFAULT '[]'
        )
      `);

      // インデックスの作成
      db.execute(
        "CREATE INDEX IF NOT EXISTS idx_tokens_client_id ON tokens(client_id)",
      );

      console.log("tokensテーブルがメインDBに作成されました");
    } catch (error) {
      console.error("tokensテーブルの作成中にエラーが発生しました:", error);
      throw error;
    }
  }

  /**
   * 既存のプレーンテキストデータを暗号化形式に移行
   * アプリケーション起動時に呼び出される（同期的に処理）
   */
  private migrateToEncryption(db: SqliteManager): void {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        console.warn(
          "セキュア暗号化は現在のシステムで利用できません。データ移行をスキップします。",
        );
        return;
      }

      // サーバーリポジトリを取得
      const serverRepository = getServerRepository();

      // すべてのサーバーを取得
      const allServers = serverRepository.getAllServers();

      if (allServers.length === 0) {
        console.log(
          "サーバーが存在しないため、暗号化マイグレーションをスキップします",
        );
        return;
      }

      let migratedCount = 0;

      // 各サーバーを再保存して暗号化を適用
      for (const server of allServers) {
        try {
          // 保存時にmapEntityToRowForUpdateが呼ばれ、データが暗号化される
          // bearerToken, env, inputParams, args, remote_urlが暗号化対象
          serverRepository.updateServer(server.id, {});
          migratedCount++;
        } catch (error) {
          console.error(
            `サーバー "${server.name}" (ID: ${server.id}) の暗号化に失敗しました:`,
            error,
          );
        }
      }

      console.log(`${migratedCount}個のサーバーデータを暗号化しました`);
    } catch (error) {
      console.error(
        "サーバーデータの暗号化移行中にエラーが発生しました:",
        error,
      );
      throw error; // マイグレーションエラーは上位に伝播させる
    }
  }

  // ==========================================================================
  // マイグレーション管理ユーティリティ
  // ==========================================================================

  /**
   * マイグレーション管理テーブルの初期化
   */
  private initMigrationTable(): void {
    const db = getSqliteManager();

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
    const db = getSqliteManager();

    // 実行済みマイグレーションを取得
    const rows = db.all<{ id: string }>("SELECT id FROM migrations");

    // Set に変換して返す
    return new Set(rows.map((row) => row.id));
  }

  /**
   * マイグレーションを記録
   */
  private markMigrationComplete(migrationId: string): void {
    const db = getSqliteManager();

    // マイグレーションを記録
    db.execute(
      "INSERT INTO migrations (id, executed_at) VALUES (:id, :executedAt)",
      {
        id: migrationId,
        executedAt: Math.floor(Date.now() / 1000),
      },
    );
  }
}

/**
 * データベースマイグレーションのシングルトンインスタンスを取得
 */
export function getDatabaseMigration(): DatabaseMigration {
  return DatabaseMigration.getInstance();
}
