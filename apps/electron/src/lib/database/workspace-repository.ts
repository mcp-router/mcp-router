import { WorkspaceRepository } from "./repositories/workspace-repository";
import { getSqliteManager, SqliteManager } from "./sqlite-manager";

let workspaceRepository: WorkspaceRepository | null = null;
let currentDb: SqliteManager | null = null;

/**
 * WorkspaceRepositoryのシングルトンインスタンスを取得
 */
export function getWorkspaceRepository(): WorkspaceRepository {
  const db = getSqliteManager();

  // Check if database instance has changed
  if (!workspaceRepository || currentDb !== db) {
    console.log(
      "[WorkspaceRepository] Database instance changed, creating new repository",
    );
    workspaceRepository = new WorkspaceRepository(db);
    currentDb = db;
  }

  return workspaceRepository;
}

/**
 * Reset WorkspaceRepository instance (used when switching workspaces)
 */
export function resetWorkspaceRepository(): void {
  console.log("[WorkspaceRepository] Resetting repository instance");
  workspaceRepository = null;
  currentDb = null;
}

export { WorkspaceRepository };
