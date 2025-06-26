import { WorkspaceRepository } from "./repositories/workspace-repository";
import { getSqliteManager } from "./sqlite-manager";

let workspaceRepository: WorkspaceRepository | null = null;

/**
 * WorkspaceRepositoryのシングルトンインスタンスを取得
 */
export function getWorkspaceRepository(): WorkspaceRepository {
  if (!workspaceRepository) {
    const db = getSqliteManager();
    workspaceRepository = new WorkspaceRepository(db);
  }
  return workspaceRepository;
}

export { WorkspaceRepository };
