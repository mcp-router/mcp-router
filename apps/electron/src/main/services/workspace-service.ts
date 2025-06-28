import { BaseService } from "./base-service";
import { Singleton } from "../../lib/utils/backend/singleton";
import { SqliteManager } from "../../lib/database/sqlite-manager";
import { safeStorage, session, app } from "electron";
import { EventEmitter } from "events";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import * as fsSync from "fs";

export interface Workspace {
  id: string;
  name: string;
  type: "local" | "remote";
  isActive: boolean;
  createdAt: Date;
  lastUsedAt: Date;
  localConfig?: {
    databasePath: string;
  };
  remoteConfig?: {
    apiUrl: string;
    authToken?: string;
    teamId?: string;
    userId?: string;
    enableCache?: boolean;
  };
  displayInfo?: {
    avatarUrl?: string;
    email?: string;
    teamName?: string;
  };
}

export interface WorkspaceCreateConfig {
  name: string;
  type: "local" | "remote";
  remoteConfig?: {
    apiUrl: string;
    authToken?: string;
    teamId?: string;
  };
}

export class WorkspaceService
  extends BaseService<Workspace, string>
  implements Singleton<WorkspaceService>
{
  private static instance: WorkspaceService | null = null;
  private electronSessions: Map<string, Electron.Session> = new Map();
  private databaseInstances: Map<string, SqliteManager> = new Map();
  private metaDb: SqliteManager | null = null;
  private eventEmitter: EventEmitter = new EventEmitter();

  public static getInstance(): WorkspaceService {
    if (!WorkspaceService.instance) {
      WorkspaceService.instance = new WorkspaceService();
    }
    return WorkspaceService.instance;
  }

  public static resetInstance(): void {
    if (WorkspaceService.instance) {
      WorkspaceService.instance.cleanup();
    }
    WorkspaceService.instance = null;
  }

  private constructor() {
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
      return rows.map((row) => this.deserializeWorkspace(row));
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

      const workspace: Workspace = {
        id: uuidv4(),
        name: config.name,
        type: config.type,
        isActive: false,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        remoteConfig: config.remoteConfig,
      };

      // ローカルワークスペースの場合、データベースパスを設定
      if (config.type === "local") {
        workspace.localConfig = {
          databasePath: path.join("workspaces", workspace.id, "database.db"),
        };
      }

      // リモートワークスペースの場合、認証トークンを暗号化
      if (config.type === "remote" && config.remoteConfig?.authToken) {
        await this.saveWorkspaceCredentials(
          workspace.id,
          config.remoteConfig.authToken,
        );
        // 元のトークンは保存しない
        workspace.remoteConfig!.authToken = undefined;
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

      // 認証トークンが含まれている場合は暗号化
      if (updates.remoteConfig?.authToken) {
        await this.saveWorkspaceCredentials(id, updates.remoteConfig.authToken);
        updates.remoteConfig.authToken = undefined;
      }

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
      const tables = [
        "servers",
        "agents",
        "deployedAgents",
        "logs",
        "settings",
        "tokens",
        "chat_sessions",
      ];

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
                const columns = Object.keys(row).join(", ");
                const placeholders = Object.keys(row)
                  .map(() => "?")
                  .join(", ");
                const values = Object.values(row);

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

      // ワークスペースディレクトリを削除（ローカルの場合）
      if (workspace.type === "local" && workspace.localConfig?.databasePath) {
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
   * 認証情報の暗号化保存
   */
  private async saveWorkspaceCredentials(
    workspaceId: string,
    token: string,
  ): Promise<void> {
    if (!this.metaDb) throw new Error("Meta database not initialized");

    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(token);
      const encryptedBase64 = encrypted.toString("base64");

      // メタDBに保存
      this.metaDb
        .prepare(
          "UPDATE workspaces SET remoteConfig = json_set(remoteConfig, '$.authToken', ?) WHERE id = ?",
        )
        .run(encryptedBase64, workspaceId);
    } else {
      throw new Error("Encryption not available");
    }
  }

  /**
   * 認証情報の復号化取得
   */
  async getWorkspaceCredentials(workspaceId: string): Promise<string | null> {
    try {
      const workspace = await this.findById(workspaceId);
      if (!workspace?.remoteConfig?.authToken) return null;

      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = Buffer.from(
          workspace.remoteConfig.authToken,
          "base64",
        );
        return safeStorage.decryptString(encrypted);
      }
      return null;
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

      if (workspace.type === "local") {
        const dbPath =
          workspace.localConfig?.databasePath ||
          path.join("workspaces", workspaceId, "database.db");

        const fullPath = path.join(app.getPath("userData"), dbPath);

        // ディレクトリが存在しない場合は作成
        await fs.mkdir(path.dirname(fullPath), { recursive: true });

        const db = new SqliteManager(fullPath);
        this.databaseInstances.set(workspaceId, db);
      } else {
        throw new Error("Remote workspace database not implemented yet");
      }
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
