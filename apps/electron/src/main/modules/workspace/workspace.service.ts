import { SingletonService } from "@/main/modules/singleton-service";
import { SqliteManager } from "../../infrastructure/database/sqlite-manager";
import { session, app } from "electron";
import { EventEmitter } from "events";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import * as fsSync from "fs";
import type { Workspace, WorkspaceCreateConfig } from "@mcp_router/shared";

export class WorkspaceService extends SingletonService<
  Workspace,
  string,
  WorkspaceService
> {
  private electronSessions: Map<string, Electron.Session> = new Map();
  private databaseInstances: Map<string, SqliteManager> = new Map();
  private metaDb: SqliteManager | null = null;
  private eventEmitter: EventEmitter = new EventEmitter();

  public static getInstance(): WorkspaceService {
    return this.getInstanceBase();
  }

  public static resetInstance(): void {
    const instance = this.getInstance();
    instance.cleanup();
    this.resetInstanceBase(WorkspaceService);
  }

  public constructor() {
    super();
    this.initializeMetaDatabase();
  }

  private initializeMetaDatabase(): void {
    // mcprouter.dbを使用するように変更
    const metaDbPath = path.join(app.getPath("userData"), "mcprouter.db");
    this.metaDb = new SqliteManager(metaDbPath);
    this.createMetaTables();
    this.initializeDefaultWorkspace();
  }

  private createMetaTables(): void {
    if (!this.metaDb) return;

    this.metaDb.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('local', 'remote')),
        isActive INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        lastUsedAt TEXT NOT NULL,
        localConfig TEXT, -- JSON
        remoteConfig TEXT, -- JSON
        displayInfo TEXT   -- JSON
      )
    `);
  }

  private initializeDefaultWorkspace(): void {
    if (!this.metaDb) return;

    const existing = this.metaDb
      .prepare("SELECT * FROM workspaces WHERE id = ?")
      .get("local-default");

    if (!existing) {
      // 既存のmcprouter.dbが存在するか確認
      const legacyDbPath = path.join(app.getPath("userData"), "mcprouter.db");
      const legacyDbExists = fsSync.existsSync(legacyDbPath);

      if (legacyDbExists) {
        console.log(
          "[WorkspaceService] Using existing mcprouter.db as default workspace",
        );

        // 既存のDBをそのまま使用する設定
        const defaultWorkspace: Workspace = {
          id: "local-default",
          name: "Local",
          type: "local",
          isActive: true,
          createdAt: new Date(),
          lastUsedAt: new Date(),
          localConfig: {
            databasePath: "mcprouter.db", // 既存のパスを使用
          },
          displayInfo: {
            // 既存データを使用していることを示す
            teamName: "Using existing data",
          },
        };

        this.metaDb
          .prepare(
            `
          INSERT INTO workspaces (id, name, type, isActive, createdAt, lastUsedAt, localConfig)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
          )
          .run(
            defaultWorkspace.id,
            defaultWorkspace.name,
            defaultWorkspace.type,
            1,
            defaultWorkspace.createdAt.toISOString(),
            defaultWorkspace.lastUsedAt.toISOString(),
            JSON.stringify(defaultWorkspace.localConfig),
          );
      } else {
        // 新規インストールの場合は新しいデータベースを作成
        const defaultWorkspace: Workspace = {
          id: "local-default",
          name: "Local",
          type: "local",
          isActive: true,
          createdAt: new Date(),
          lastUsedAt: new Date(),
          localConfig: {
            databasePath: path.join(
              "workspaces",
              "local-default",
              "database.db",
            ),
          },
        };

        this.metaDb
          .prepare(
            `
          INSERT INTO workspaces (id, name, type, isActive, createdAt, lastUsedAt, localConfig)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
          )
          .run(
            defaultWorkspace.id,
            defaultWorkspace.name,
            defaultWorkspace.type,
            1,
            defaultWorkspace.createdAt.toISOString(),
            defaultWorkspace.lastUsedAt.toISOString(),
            JSON.stringify(defaultWorkspace.localConfig),
          );
      }
    }
  }

  protected getEntityName(): string {
    return "Workspace";
  }

  /**
   * ワークスペース一覧を取得
   */
  async list(): Promise<Workspace[]> {
    try {
      if (!this.metaDb) return [];
      const rows = this.metaDb
        .prepare("SELECT * FROM workspaces ORDER BY lastUsedAt DESC")
        .all();
      return rows.map((row: any) => this.deserializeWorkspace(row));
    } catch (error) {
      return this.handleError("list", error, []);
    }
  }

  /**
   * ワークスペースをIDで取得
   */
  async findById(id: string): Promise<Workspace | null> {
    try {
      if (!this.metaDb) return null;
      const row = this.metaDb
        .prepare("SELECT * FROM workspaces WHERE id = ?")
        .get(id);
      return row ? this.deserializeWorkspace(row) : null;
    } catch (error) {
      return this.handleError("get", error, null);
    }
  }

  /**
   * 新しいワークスペースを作成
   */
  async create(config: WorkspaceCreateConfig): Promise<Workspace> {
    try {
      if (!this.metaDb) throw new Error("Meta database not initialized");

      const workspaceId = config.id ?? uuidv4();
      const workspace: Workspace = {
        id: workspaceId,
        name: config.name,
        type: config.type,
        isActive: false,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        remoteConfig: config.remoteConfig,
      };

      // すべてのワークスペースにデータベースパスを設定（リモートも含む）
      workspace.localConfig = {
        databasePath: path.join("workspaces", workspaceId, "database.db"),
      };

      // リモートワークスペースの場合、設定を保存
      if (config.type === "remote" && config.remoteConfig) {
        workspace.remoteConfig = config.remoteConfig;
      }

      this.metaDb
        .prepare(
          `
        INSERT INTO workspaces (id, name, type, isActive, createdAt, lastUsedAt, localConfig, remoteConfig, displayInfo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          workspace.id,
          workspace.name,
          workspace.type,
          0,
          workspace.createdAt.toISOString(),
          workspace.lastUsedAt.toISOString(),
          workspace.localConfig ? JSON.stringify(workspace.localConfig) : null,
          workspace.remoteConfig
            ? JSON.stringify(workspace.remoteConfig)
            : null,
          workspace.displayInfo ? JSON.stringify(workspace.displayInfo) : null,
        );

      return workspace;
    } catch (error) {
      return this.handleError("create", error);
    }
  }

  /**
   * ワークスペースを更新
   */
  async update(id: string, updates: Partial<Workspace>): Promise<void> {
    try {
      if (!this.metaDb) throw new Error("Meta database not initialized");

      const workspace = await this.findById(id);
      if (!workspace) throw new Error(`Workspace ${id} not found`);

      // 認証トークンの更新処理は特に必要なし

      const updated = { ...workspace, ...updates, lastUsedAt: new Date() };

      this.metaDb
        .prepare(
          `
        UPDATE workspaces 
        SET name = ?, type = ?, isActive = ?, lastUsedAt = ?, 
            localConfig = ?, remoteConfig = ?, displayInfo = ?
        WHERE id = ?
      `,
        )
        .run(
          updated.name,
          updated.type,
          updated.isActive ? 1 : 0,
          updated.lastUsedAt.toISOString(),
          updated.localConfig ? JSON.stringify(updated.localConfig) : null,
          updated.remoteConfig ? JSON.stringify(updated.remoteConfig) : null,
          updated.displayInfo ? JSON.stringify(updated.displayInfo) : null,
          id,
        );
    } catch (error) {
      this.handleError("update", error);
    }
  }

  /**
   * 既存のデータベースから新しいワークスペースにデータをコピー
   */
  async copyDataToNewWorkspace(
    sourceDbPath: string,
    targetWorkspaceId: string,
  ): Promise<void> {
    try {
      const targetWorkspace = await this.findById(targetWorkspaceId);
      if (!targetWorkspace || targetWorkspace.type !== "local") {
        throw new Error("Target workspace is invalid");
      }

      const targetDb = await this.getWorkspaceDatabase(targetWorkspaceId);
      const sourceDb = new SqliteManager(sourceDbPath);

      // テーブルごとにデータをコピー
      const tables = ["servers", "logs", "settings", "tokens"];

      for (const table of tables) {
        try {
          // ソーステーブルが存在するか確認
          const tableExists = sourceDb.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
            [table],
          );

          if (tableExists) {
            console.log(
              `[WorkspaceService] Copying data from ${table} table...`,
            );

            // データを取得
            const rows = sourceDb.all(`SELECT * FROM ${table}`);

            if (rows.length > 0) {
              // ターゲットテーブルをクリア
              targetDb.exec(`DELETE FROM ${table}`);

              // データを挿入
              for (const row of rows) {
                const columns = Object.keys(row as object).join(", ");
                const placeholders = Object.keys(row as object)
                  .map(() => "?")
                  .join(", ");
                const values = Object.values(row as object);

                targetDb
                  .prepare(
                    `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`,
                  )
                  .run(...values);
              }

              console.log(
                `[WorkspaceService] ${table} table: Copied ${rows.length} rows`,
              );
            }
          }
        } catch (error) {
          console.error(
            `[WorkspaceService] Failed to copy ${table} table:`,
            error,
          );
        }
      }

      sourceDb.close();
      console.log("[WorkspaceService] Data copy completed");
    } catch (error) {
      this.handleError("data copy", error);
    }
  }

  /**
   * ワークスペースを削除
   */
  async delete(id: string): Promise<void> {
    try {
      if (!this.metaDb) throw new Error("Meta database not initialized");

      // デフォルトワークスペースは削除できない
      if (id === "local-default") {
        throw new Error("Cannot delete default local workspace");
      }

      const workspace = await this.findById(id);
      if (!workspace) {
        throw new Error("Workspace not found");
      }

      if (workspace.isActive) {
        // アクティブなワークスペースを削除する場合は、デフォルトに切り替え
        await this.switchWorkspace("local-default");
      }

      // データベースインスタンスをクローズ
      if (this.databaseInstances.has(id)) {
        const db = this.databaseInstances.get(id);
        db?.close();
        this.databaseInstances.delete(id);
      }

      // セッションの削除
      if (this.electronSessions.has(id)) {
        this.electronSessions.delete(id);
      }

      // ワークスペースディレクトリを削除（ローカル・リモート両方）
      if (workspace.localConfig?.databasePath) {
        const workspaceDir = path.dirname(
          path.join(
            app.getPath("userData"),
            workspace.localConfig.databasePath,
          ),
        );
        await fs.rm(workspaceDir, { recursive: true, force: true });
      }

      // メタデータから削除
      this.metaDb.prepare("DELETE FROM workspaces WHERE id = ?").run(id);
    } catch (error) {
      this.handleError("delete", error);
    }
  }

  /**
   * アクティブなワークスペースを取得
   */
  async getActiveWorkspace(): Promise<Workspace | null> {
    try {
      if (!this.metaDb) return null;
      const row = this.metaDb
        .prepare("SELECT * FROM workspaces WHERE isActive = 1")
        .get();
      return row ? this.deserializeWorkspace(row) : null;
    } catch (error) {
      return this.handleError("get active workspace", error, null);
    }
  }

  /**
   * 認証情報の取得
   */
  async getWorkspaceCredentials(workspaceId: string): Promise<string | null> {
    try {
      const workspace = await this.findById(workspaceId);
      return workspace?.remoteConfig?.authToken || null;
    } catch (error) {
      return this.handleError("get credentials", error, null);
    }
  }

  /**
   * ワークスペース固有のデータベースを取得
   */
  async getWorkspaceDatabase(workspaceId: string): Promise<SqliteManager> {
    if (!this.databaseInstances.has(workspaceId)) {
      const workspace = await this.findById(workspaceId);
      if (!workspace) throw new Error(`Workspace ${workspaceId} not found`);

      // ローカル・リモート両方のワークスペースでデータベースを作成
      const dbPath =
        workspace.localConfig?.databasePath ||
        path.join("workspaces", workspaceId, "database.db");

      const fullPath = path.join(app.getPath("userData"), dbPath);

      // ディレクトリが存在しない場合は作成
      await fs.mkdir(path.dirname(fullPath), { recursive: true });

      const db = new SqliteManager(fullPath);
      this.databaseInstances.set(workspaceId, db);
    }

    const db = this.databaseInstances.get(workspaceId);
    if (!db) throw new Error(`Database for workspace ${workspaceId} not found`);

    return db;
  }

  /**
   * セッションの分離
   */
  getIsolatedSession(workspaceId: string): Electron.Session {
    if (!this.electronSessions.has(workspaceId)) {
      const partition = `persist:workspace-${workspaceId}`;
      const isolatedSession = session.fromPartition(partition);
      this.electronSessions.set(workspaceId, isolatedSession);
    }
    return this.electronSessions.get(workspaceId)!;
  }

  /**
   * ワークスペース切り替え
   */
  async switchWorkspace(workspaceId: string): Promise<void> {
    try {
      if (!this.metaDb) throw new Error("Meta database not initialized");

      const workspace = await this.findById(workspaceId);
      if (!workspace) {
        throw new Error("Workspace not found");
      }

      // 現在のDBをクローズ
      const currentWorkspace = await this.getActiveWorkspace();
      if (currentWorkspace && this.databaseInstances.has(currentWorkspace.id)) {
        const currentDb = this.databaseInstances.get(currentWorkspace.id);
        currentDb?.close();
        this.databaseInstances.delete(currentWorkspace.id);
      }

      // 新しいワークスペースをアクティブに
      this.metaDb.transaction(() => {
        this.metaDb!.prepare("UPDATE workspaces SET isActive = 0").run();
        this.metaDb!.prepare(
          "UPDATE workspaces SET isActive = 1, lastUsedAt = ? WHERE id = ?",
        ).run(new Date().toISOString(), workspaceId);
      });

      // イベントを発火して、Platform APIの切り替えをトリガー
      this.eventEmitter.emit("workspace-switched", workspace);
    } catch (error) {
      this.handleError("switch", error);
    }
  }

  /**
   * ワークスペース切り替えイベントのリスナー登録
   */
  onWorkspaceSwitched(callback: (workspace: Workspace) => void): void {
    this.eventEmitter.on("workspace-switched", callback);
  }

  /**
   * ワークスペース切り替えイベントのリスナー解除
   */
  offWorkspaceSwitched(callback: (workspace: Workspace) => void): void {
    this.eventEmitter.off("workspace-switched", callback);
  }

  private deserializeWorkspace(row: any): Workspace {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      isActive: row.isActive === 1,
      localConfig: row.localConfig ? JSON.parse(row.localConfig) : undefined,
      remoteConfig: row.remoteConfig ? JSON.parse(row.remoteConfig) : undefined,
      displayInfo: row.displayInfo ? JSON.parse(row.displayInfo) : undefined,
      createdAt: new Date(row.createdAt),
      lastUsedAt: new Date(row.lastUsedAt),
    };
  }

  private cleanup(): void {
    // すべてのデータベースインスタンスをクローズ
    for (const [_, db] of this.databaseInstances) {
      db.close();
    }
    this.databaseInstances.clear();

    // メタデータベースをクローズ
    if (this.metaDb) {
      this.metaDb.close();
      this.metaDb = null;
    }

    // セッションをクリア
    this.electronSessions.clear();
  }
}

/**
 * WorkspaceServiceのシングルトンインスタンスを取得
 */
export function getWorkspaceService(): WorkspaceService {
  return WorkspaceService.getInstance();
}
