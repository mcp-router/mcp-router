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
    // Use mcprouter.db
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
      // Check if existing mcprouter.db exists
      const legacyDbPath = path.join(app.getPath("userData"), "mcprouter.db");
      const legacyDbExists = fsSync.existsSync(legacyDbPath);

      if (legacyDbExists) {
        console.log(
          "[WorkspaceService] Using existing mcprouter.db as default workspace",
        );

        // Configure to use existing DB as-is
        const defaultWorkspace: Workspace = {
          id: "local-default",
          name: "Local",
          type: "local",
          isActive: true,
          createdAt: new Date(),
          lastUsedAt: new Date(),
          localConfig: {
            databasePath: "mcprouter.db", // Use existing path
          },
          displayInfo: {
            // Indicates using existing data
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
        // For new installs, create a new database
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
   * Get workspace list
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
   * Get workspace by ID
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
   * Create a new workspace
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

      // Set database path for all workspaces (including remote)
      workspace.localConfig = {
        databasePath: path.join("workspaces", workspaceId, "database.db"),
      };

      // Save remote config if workspace is remote
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
   * Update a workspace
   */
  async update(id: string, updates: Partial<Workspace>): Promise<void> {
    try {
      if (!this.metaDb) throw new Error("Meta database not initialized");

      const workspace = await this.findById(id);
      if (!workspace) throw new Error(`Workspace ${id} not found`);

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
   * Copy data from an existing database to a new workspace
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

      // Copy data for each table
      const tables = ["servers", "logs", "settings", "tokens"];

      for (const table of tables) {
        try {
          // Check if source table exists
          const tableExists = sourceDb.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
            [table],
          );

          if (tableExists) {
            console.log(
              `[WorkspaceService] Copying data from ${table} table...`,
            );

            // Get data
            const rows = sourceDb.all(`SELECT * FROM ${table}`);

            if (rows.length > 0) {
              // Clear target table
              targetDb.exec(`DELETE FROM ${table}`);

              // Insert data
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
   * Delete a workspace
   */
  async delete(id: string): Promise<void> {
    try {
      if (!this.metaDb) throw new Error("Meta database not initialized");

      // Cannot delete the default workspace
      if (id === "local-default") {
        throw new Error("Cannot delete default local workspace");
      }

      const workspace = await this.findById(id);
      if (!workspace) {
        throw new Error("Workspace not found");
      }

      if (workspace.isActive) {
        // If deleting the active workspace, switch to default
        await this.switchWorkspace("local-default");
      }

      // Close database instance
      if (this.databaseInstances.has(id)) {
        const db = this.databaseInstances.get(id);
        db?.close();
        this.databaseInstances.delete(id);
      }

      // Remove session
      if (this.electronSessions.has(id)) {
        this.electronSessions.delete(id);
      }

      // Delete workspace directory (both local and remote)
      if (workspace.localConfig?.databasePath) {
        const workspaceDir = path.dirname(
          path.join(
            app.getPath("userData"),
            workspace.localConfig.databasePath,
          ),
        );
        await fs.rm(workspaceDir, { recursive: true, force: true });
      }

      // Delete from metadata
      this.metaDb.prepare("DELETE FROM workspaces WHERE id = ?").run(id);
    } catch (error) {
      this.handleError("delete", error);
    }
  }

  /**
   * Get the active workspace
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
   * Get credentials for a workspace
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
   * Get the workspace-specific database
   */
  async getWorkspaceDatabase(workspaceId: string): Promise<SqliteManager> {
    if (!this.databaseInstances.has(workspaceId)) {
      const workspace = await this.findById(workspaceId);
      if (!workspace) throw new Error(`Workspace ${workspaceId} not found`);

      // Create database for both local and remote workspaces
      const dbPath =
        workspace.localConfig?.databasePath ||
        path.join("workspaces", workspaceId, "database.db");

      const fullPath = path.join(app.getPath("userData"), dbPath);

      // Create directory if it doesn't exist
      await fs.mkdir(path.dirname(fullPath), { recursive: true });

      const db = new SqliteManager(fullPath);
      this.databaseInstances.set(workspaceId, db);
    }

    const db = this.databaseInstances.get(workspaceId);
    if (!db) throw new Error(`Database for workspace ${workspaceId} not found`);

    return db;
  }

  /**
   * Get an isolated session for a workspace
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
   * Switch workspace
   */
  async switchWorkspace(workspaceId: string): Promise<void> {
    try {
      if (!this.metaDb) throw new Error("Meta database not initialized");

      const workspace = await this.findById(workspaceId);
      if (!workspace) {
        throw new Error("Workspace not found");
      }

      // Close current DB
      const currentWorkspace = await this.getActiveWorkspace();
      if (currentWorkspace && this.databaseInstances.has(currentWorkspace.id)) {
        const currentDb = this.databaseInstances.get(currentWorkspace.id);
        currentDb?.close();
        this.databaseInstances.delete(currentWorkspace.id);
      }

      // Activate the new workspace
      this.metaDb.transaction(() => {
        this.metaDb!.prepare("UPDATE workspaces SET isActive = 0").run();
        this.metaDb!.prepare(
          "UPDATE workspaces SET isActive = 1, lastUsedAt = ? WHERE id = ?",
        ).run(new Date().toISOString(), workspaceId);
      });

      // Emit event to trigger Platform API switching
      this.eventEmitter.emit("workspace-switched", workspace);
    } catch (error) {
      this.handleError("switch", error);
    }
  }

  /**
   * Register listener for workspace switch events
   */
  onWorkspaceSwitched(callback: (workspace: Workspace) => void): void {
    this.eventEmitter.on("workspace-switched", callback);
  }

  /**
   * Unregister listener for workspace switch events
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
    // Close all database instances
    for (const [_, db] of this.databaseInstances) {
      db.close();
    }
    this.databaseInstances.clear();

    // Close meta database
    if (this.metaDb) {
      this.metaDb.close();
      this.metaDb = null;
    }

    // Clear sessions
    this.electronSessions.clear();
  }
}

/**
 * Get the singleton instance of WorkspaceService
 */
export function getWorkspaceService(): WorkspaceService {
  return WorkspaceService.getInstance();
}
