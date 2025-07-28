// Core exports
export { SqliteManager, getSqliteManager } from "./core/sqlite-manager";
export { DatabaseContext, getDatabaseContext } from "./core/database-context";
export { BaseRepository } from "./core/base-repository";

// Schema exports
export { DATABASE_SCHEMA, SCHEMA_VERSION, type TableName } from "./schema";

// Repository exports
export { AgentRepository } from "./repositories/agent/agent-repository";
export { DeployedAgentRepository } from "./repositories/deployed-agent/deployed-agent-repository";
export { LogRepository } from "./repositories/log/log-repository";
export { ServerRepository } from "./repositories/server/server-repository";
export { SessionRepository } from "./repositories/session/session-repository";
export { SettingsRepository } from "./repositories/settings/settings-repository";
export { TokenRepository } from "./repositories/token/token-repository";
export { WorkspaceRepository } from "./repositories/workspace/workspace-repository";

// Factory exports
export { RepositoryFactory } from "./factories/repository-factory";

// Migration exports
export { getDatabaseMigration } from "./migrations/database-migration";

// Internal imports for backwards compatibility functions
import { getSqliteManager } from "./core/sqlite-manager";
import { RepositoryFactory } from "./factories/repository-factory";

// Backwards compatibility functions using RepositoryFactory
export function getAgentRepository() {
  const db = getSqliteManager("mcprouter");
  return RepositoryFactory.getAgentRepository(db);
}

export function resetAgentRepository() {
  // No-op: Reset is handled by RepositoryFactory
}

export function getDeployedAgentRepository() {
  const db = getSqliteManager("mcprouter");
  return RepositoryFactory.getDeployedAgentRepository(db);
}

export function resetDeployedAgentRepository() {
  // No-op: Reset is handled by RepositoryFactory
}

export function getLogRepository() {
  const db = getSqliteManager("mcprouter");
  return RepositoryFactory.getLogRepository(db);
}

export function resetLogRepository() {
  // No-op: Reset is handled by RepositoryFactory
}

export function getServerRepository() {
  const db = getSqliteManager("mcprouter");
  return RepositoryFactory.getServerRepository(db);
}

export function resetServerRepository() {
  // No-op: Reset is handled by RepositoryFactory
}

export function getSessionRepository() {
  const db = getSqliteManager("mcprouter");
  return RepositoryFactory.getSessionRepository(db);
}

export function resetSessionRepository() {
  // No-op: Reset is handled by RepositoryFactory
}

export function getSettingsRepository() {
  const db = getSqliteManager("mcprouter");
  return RepositoryFactory.getSettingsRepository(db);
}

export function resetSettingsRepository() {
  // No-op: Reset is handled by RepositoryFactory
}

export function getTokenRepository() {
  // Token repository uses main database
  const db = getSqliteManager("mcprouter", true);
  return RepositoryFactory.getTokenRepository(db);
}

export function resetTokenRepository() {
  // No-op: Tokens are shared across workspaces
}

export function getWorkspaceRepository() {
  const db = getSqliteManager("mcprouter");
  return RepositoryFactory.getWorkspaceRepository(db);
}

export function resetWorkspaceRepository() {
  // No-op: Reset is handled by RepositoryFactory
}
