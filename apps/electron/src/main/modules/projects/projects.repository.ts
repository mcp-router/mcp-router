import { BaseRepository } from "@/main/infrastructure/database/base-repository";
import type { Project } from "@mcp_router/shared";
import type { SqliteManager } from "@/main/infrastructure/database/sqlite-manager";
import { getSqliteManager } from "@/main/infrastructure/database/sqlite-manager";

export class ProjectRepository extends BaseRepository<Project> {
  private static instance: ProjectRepository | null = null;

  private constructor(db: SqliteManager) {
    super(db, "projects");
  }

  public static getInstance(): ProjectRepository {
    const db = getSqliteManager();
    if (
      !ProjectRepository.instance ||
      ProjectRepository.instance.database !== db
    ) {
      ProjectRepository.instance = new ProjectRepository(db);
    }
    return ProjectRepository.instance;
  }

  public static resetInstance(): void {
    ProjectRepository.instance = null;
  }

  protected initializeTable(): void {
    // Create table and index if not exists
    this.db.execute(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        optimization TEXT
      )
    `);
    this.db.execute(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_name_unique ON projects(name COLLATE NOCASE)",
    );
  }

  protected mapRowToEntity(row: any): Project {
    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      optimization: row.optimization ?? null,
    };
  }

  protected mapEntityToRow(entity: Project): Record<string, any> {
    const now = Date.now();
    return {
      id: entity.id,
      name: entity.name,
      created_at: entity.createdAt ?? now,
      updated_at: now,
      optimization: entity.optimization ?? null,
    };
  }

  public findByName(name: string): Project | null {
    const trimmed = name.trim();
    if (!trimmed) {
      return null;
    }

    const row = this.db.get<any>(
      "SELECT * FROM projects WHERE name = :name COLLATE NOCASE",
      { name: trimmed },
    );

    return row ? this.mapRowToEntity(row) : null;
  }
}
