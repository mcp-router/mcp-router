import { BaseRepository } from "@/main/infrastructure/database/base-repository";
import type { SqliteManager } from "@/main/infrastructure/database/sqlite-manager";
import { getSqliteManager } from "@/main/infrastructure/database/sqlite-manager";
import type { Skill } from "@mcp_router/shared";

/**
 * Skills repository for database operations
 */
export class SkillRepository extends BaseRepository<Skill> {
  private static instance: SkillRepository | null = null;

  private constructor(db: SqliteManager) {
    super(db, "skills");
  }

  public static getInstance(): SkillRepository {
    const db = getSqliteManager();
    if (!SkillRepository.instance || SkillRepository.instance.database !== db) {
      SkillRepository.instance = new SkillRepository(db);
    }
    return SkillRepository.instance;
  }

  public static resetInstance(): void {
    SkillRepository.instance = null;
  }

  protected initializeTable(): void {
    this.db.execute(`
      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        project_id TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Create index for case-insensitive name lookup
    this.db.execute(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_name_unique ON skills(name COLLATE NOCASE)",
    );
  }

  protected mapRowToEntity(row: any): Skill {
    return {
      id: row.id,
      name: row.name,
      projectId: row.project_id ?? null,
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  protected mapEntityToRow(entity: Skill): Record<string, any> {
    const now = Date.now();
    return {
      id: entity.id,
      name: entity.name,
      project_id: entity.projectId ?? null,
      enabled: entity.enabled ? 1 : 0,
      created_at: entity.createdAt ?? now,
      updated_at: now,
    };
  }

  /**
   * Find skill by name (case-insensitive)
   */
  public findByName(name: string): Skill | null {
    const trimmed = name.trim();
    if (!trimmed) {
      return null;
    }

    const row = this.db.get<any>(
      "SELECT * FROM skills WHERE name = :name COLLATE NOCASE",
      { name: trimmed },
    );

    return row ? this.mapRowToEntity(row) : null;
  }
}
