import { BaseRepository } from "../../infrastructure/database/base-repository";
import {
  SqliteManager,
  getSqliteManager,
} from "../../infrastructure/database/sqlite-manager";
import { Workspace } from "@mcp_router/shared";

export class WorkspaceRepository extends BaseRepository<Workspace> {
  private static instance: WorkspaceRepository | null = null;
  /**
   * Table creation SQL
   */
  private static readonly CREATE_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('local', 'remote')),
      isActive INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      lastUsedAt TEXT NOT NULL,
      localConfig TEXT,
      remoteConfig TEXT,
      displayInfo TEXT
    )
  `;

  /**
   * Index creation SQL
   */
  private static readonly INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_workspaces_active ON workspaces(isActive)",
    "CREATE INDEX IF NOT EXISTS idx_workspaces_type ON workspaces(type)",
    "CREATE INDEX IF NOT EXISTS idx_workspaces_last_used ON workspaces(lastUsedAt)",
  ];

  private constructor(db: SqliteManager) {
    super(db, "workspaces");
    console.log(
      "[WorkspaceRepository] Constructor called with database:",
      db?.getDbPath?.() || "database instance",
    );
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): WorkspaceRepository {
    const db = getSqliteManager();
    if (
      !WorkspaceRepository.instance ||
      WorkspaceRepository.instance.db !== db
    ) {
      WorkspaceRepository.instance = new WorkspaceRepository(db);
    }
    return WorkspaceRepository.instance;
  }

  /**
   * Reset instance
   */
  public static resetInstance(): void {
    WorkspaceRepository.instance = null;
  }

  /**
   * Initialize table (implements BaseRepository abstract method)
   */
  protected initializeTable(): void {
    try {
      // Create table
      this.db.execute(WorkspaceRepository.CREATE_TABLE_SQL);

      // Create indexes
      WorkspaceRepository.INDEXES.forEach((indexSQL) => {
        this.db.execute(indexSQL);
      });

      console.log("[WorkspaceRepository] Table initialization completed");
    } catch (error) {
      console.error(
        "[WorkspaceRepository] Error during table initialization:",
        error,
      );
      throw error;
    }
  }

  /**
   * Convert a database row to a Workspace entity
   */
  protected mapRowToEntity(row: any): Workspace {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      isActive: row.isActive === 1,
      createdAt: new Date(row.createdAt),
      lastUsedAt: new Date(row.lastUsedAt),
      localConfig: row.localConfig ? JSON.parse(row.localConfig) : undefined,
      remoteConfig: row.remoteConfig ? JSON.parse(row.remoteConfig) : undefined,
      displayInfo: row.displayInfo ? JSON.parse(row.displayInfo) : undefined,
    };
  }

  /**
   * Convert a Workspace entity to a database row for storage
   */
  protected mapEntityToRow(workspace: Workspace): any {
    return {
      id: workspace.id,
      name: workspace.name,
      type: workspace.type,
      isActive: workspace.isActive ? 1 : 0,
      createdAt: workspace.createdAt.toISOString(),
      lastUsedAt: workspace.lastUsedAt.toISOString(),
      localConfig: workspace.localConfig
        ? JSON.stringify(workspace.localConfig)
        : null,
      remoteConfig: workspace.remoteConfig
        ? JSON.stringify(workspace.remoteConfig)
        : null,
      displayInfo: workspace.displayInfo
        ? JSON.stringify(workspace.displayInfo)
        : null,
    };
  }

  /**
   * Get the active workspace
   */
  getActiveWorkspace(): Workspace | null {
    return this.findOne("isActive = ?", [1]);
  }

  /**
   * Switch the active workspace
   */
  setActiveWorkspace(workspaceId: string): void {
    this.db.transaction(() => {
      // Deactivate all workspaces
      this.db.execute("UPDATE workspaces SET isActive = 0");
      // Activate the specified workspace
      this.db.execute(
        "UPDATE workspaces SET isActive = 1, lastUsedAt = :lastUsedAt WHERE id = :id",
        {
          lastUsedAt: new Date().toISOString(),
          id: workspaceId,
        },
      );
    });
  }

  /**
   * Update encrypted credentials
   */
  updateCredentials(workspaceId: string, encryptedToken: Buffer): void {
    const workspace = this.findById(workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const remoteConfig: any = workspace.remoteConfig || {};
    remoteConfig.authToken = encryptedToken.toString("base64");

    this.db.execute(
      "UPDATE workspaces SET remoteConfig = :remoteConfig WHERE id = :id",
      {
        remoteConfig: JSON.stringify(remoteConfig),
        id: workspaceId,
      },
    );
  }

  /**
   * Get encrypted credentials
   */
  getCredentials(workspaceId: string): string | null {
    const workspace = this.findById(workspaceId);
    if (!workspace || !workspace.remoteConfig) {
      return null;
    }

    return workspace.remoteConfig.authToken || null;
  }
}
