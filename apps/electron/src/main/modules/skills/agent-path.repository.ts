import { BaseRepository } from "@/main/infrastructure/database/base-repository";
import type { SqliteManager } from "@/main/infrastructure/database/sqlite-manager";
import { getSqliteManager } from "@/main/infrastructure/database/sqlite-manager";
import type { AgentPath } from "@mcp_router/shared";

/**
 * Agent path repository for database operations
 */
export class AgentPathRepository extends BaseRepository<AgentPath> {
  private static instance: AgentPathRepository | null = null;

  private constructor(db: SqliteManager) {
    super(db, "agent_paths");
  }

  public static getInstance(): AgentPathRepository {
    const db = getSqliteManager();
    if (
      !AgentPathRepository.instance ||
      AgentPathRepository.instance.database !== db
    ) {
      AgentPathRepository.instance = new AgentPathRepository(db);
    }
    return AgentPathRepository.instance;
  }

  public static resetInstance(): void {
    AgentPathRepository.instance = null;
  }

  protected initializeTable(): void {
    this.db.execute(`
      CREATE TABLE IF NOT EXISTS agent_paths (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        path TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
  }

  protected mapRowToEntity(row: any): AgentPath {
    return {
      id: row.id,
      name: row.name,
      path: row.path,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  protected mapEntityToRow(entity: AgentPath): Record<string, any> {
    const now = Date.now();
    return {
      id: entity.id,
      name: entity.name,
      path: entity.path,
      created_at: entity.createdAt ?? now,
      updated_at: now,
    };
  }

  /**
   * Find agent path by name (case-insensitive)
   */
  public findByName(name: string): AgentPath | null {
    const trimmed = name.trim();
    if (!trimmed) {
      return null;
    }

    const row = this.db.get<any>(
      "SELECT * FROM agent_paths WHERE name = :name COLLATE NOCASE",
      { name: trimmed },
    );

    return row ? this.mapRowToEntity(row) : null;
  }
}
