import { getSqliteManager, SqliteManager } from "./sqlite-manager";
import { McpServerManagerRepository } from "../../modules/mcp-server-manager/mcp-server-manager.repository";
import { Migration } from "@mcp_router/shared";
import { safeStorage } from "electron";

/**
 * データベースマイグレーション管理クラス
 * 全てのマイグレーションを一元管理
 */
export class MainDatabaseMigration {
  private static instance: MainDatabaseMigration | null = null;
  // 登録されたマイグレーションリスト（順序付き）
  private migrations: Migration[] = [];

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(db: SqliteManager): MainDatabaseMigration {
    if (!MainDatabaseMigration.instance) {
      MainDatabaseMigration.instance = new MainDatabaseMigration(db);
    }
    return MainDatabaseMigration.instance;
  }

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

    // データ暗号化マイグレーション
    this.migrations.push({
      id: "20250513_encrypt_server_data",
      description: "Encrypt server sensitive data",
      execute: (db) => this.migrateToEncryption(db),
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

  /**
   * トークンテーブルをメインDBに確実に作成するマイグレーション
   */
  private migrateEnsureTokensTableInMainDb(db: SqliteManager): void {
    try {
      // tokensテーブルの作成はTokenRepositoryで行うため、ここでは何もしない
      console.log("tokensテーブルの作成はTokenRepositoryに委譲されます");
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
      const serverRepository = McpServerManagerRepository.getInstance();

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
    return new Set(rows.map((row: any) => row.id));
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

  /**
   * hooksテーブルを追加するマイグレーション
   */
  private migrateAddHooksTable(db: SqliteManager): void {
    try {
      // HookRepositoryが初めて呼ばれた時に
      // テーブルが作成されるため、ここでは何もしない
      console.log("hooksテーブルの作成はHookRepositoryに委譲されます");
    } catch (error) {
      console.error(
        "hooksテーブルのマイグレーション中にエラーが発生しました:",
        error,
      );
      throw error;
    }
  }
}
