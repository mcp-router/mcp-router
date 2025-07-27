import { WorkspaceRepository } from "./repositories/workspace-repository";
import { getSqliteManager, SqliteManager } from "./sqlite-manager";

let workspaceRepository: WorkspaceRepository | null = null;
let currentDb: SqliteManager | null = null;

/**
 * Reset WorkspaceRepository instance (used when switching workspaces)
 */
export function resetWorkspaceRepository(): void {
  console.log("[WorkspaceRepository] Resetting repository instance");
  workspaceRepository = null;
  currentDb = null;
}
