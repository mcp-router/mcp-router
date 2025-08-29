import { SqliteManager } from "../core/sqlite-manager";
import { AgentRepository } from "../repositories/agent/agent-repository";
import { DeployedAgentRepository } from "../repositories/deployed-agent/deployed-agent-repository";
import { LogRepository } from "../repositories/log/log-repository";
import { ServerRepository } from "../repositories/server/server-repository";
import { SessionRepository } from "../repositories/session/session-repository";
import { SettingsRepository } from "../repositories/settings/settings-repository";
import { TokenRepository } from "../repositories/token/token-repository";
import { WorkspaceRepository } from "../repositories/workspace/workspace-repository";

/**
 * リポジトリインスタンスのマップ型
 */
type RepositoryInstances = {
  agent: AgentRepository | null;
  deployedAgent: DeployedAgentRepository | null;
  log: LogRepository | null;
  server: ServerRepository | null;
  session: SessionRepository | null;
  settings: SettingsRepository | null;
  token: TokenRepository | null;
  workspace: WorkspaceRepository | null;
};

/**
 * リポジトリファクトリクラス
 * シングルトンパターンでリポジトリインスタンスを管理
 */
export class RepositoryFactory {
  private static instances: RepositoryInstances = {
    agent: null,
    deployedAgent: null,
    log: null,
    server: null,
    session: null,
    settings: null,
    token: null,
    workspace: null,
  };

  private static currentDb: SqliteManager | null = null;

  /**
   * データベースインスタンスが変更されたかチェック
   */
  private static isDatabaseChanged(db: SqliteManager): boolean {
    return this.currentDb !== db;
  }

  /**
   * すべてのリポジトリインスタンスをリセット
   */
  private static resetAllInstances(): void {
    console.log("[RepositoryFactory] Resetting all repository instances");
    this.instances = {
      agent: null,
      deployedAgent: null,
      log: null,
      server: null,
      session: null,
      settings: null,
      token: null,
      workspace: null,
    };
  }

  /**
   * エージェントリポジトリを取得
   */
  public static getAgentRepository(db: SqliteManager): AgentRepository {
    if (this.isDatabaseChanged(db)) {
      console.log(
        "[RepositoryFactory] Database instance changed, resetting all repositories",
      );
      this.resetAllInstances();
      this.currentDb = db;
    }

    if (!this.instances.agent) {
      console.log("[RepositoryFactory] Creating new AgentRepository instance");
      this.instances.agent = new AgentRepository(db);
    }

    return this.instances.agent;
  }

  /**
   * デプロイ済みエージェントリポジトリを取得
   */
  public static getDeployedAgentRepository(
    db: SqliteManager,
  ): DeployedAgentRepository {
    if (this.isDatabaseChanged(db)) {
      this.resetAllInstances();
      this.currentDb = db;
    }

    if (!this.instances.deployedAgent) {
      console.log(
        "[RepositoryFactory] Creating new DeployedAgentRepository instance",
      );
      this.instances.deployedAgent = new DeployedAgentRepository(db);
    }

    return this.instances.deployedAgent;
  }

  /**
   * ログリポジトリを取得
   */
  public static getLogRepository(db: SqliteManager): LogRepository {
    if (this.isDatabaseChanged(db)) {
      this.resetAllInstances();
      this.currentDb = db;
    }

    if (!this.instances.log) {
      console.log("[RepositoryFactory] Creating new LogRepository instance");
      this.instances.log = new LogRepository(db);
    }

    return this.instances.log;
  }

  /**
   * サーバーリポジトリを取得
   */
  public static getServerRepository(db: SqliteManager): ServerRepository {
    if (this.isDatabaseChanged(db)) {
      this.resetAllInstances();
      this.currentDb = db;
    }

    if (!this.instances.server) {
      console.log("[RepositoryFactory] Creating new ServerRepository instance");
      this.instances.server = new ServerRepository(db);
    }

    return this.instances.server;
  }

  /**
   * セッションリポジトリを取得
   */
  public static getSessionRepository(db: SqliteManager): SessionRepository {
    if (this.isDatabaseChanged(db)) {
      this.resetAllInstances();
      this.currentDb = db;
    }

    if (!this.instances.session) {
      console.log(
        "[RepositoryFactory] Creating new SessionRepository instance",
      );
      this.instances.session = new SessionRepository(db);
    }

    return this.instances.session;
  }

  /**
   * 設定リポジトリを取得
   */
  public static getSettingsRepository(db: SqliteManager): SettingsRepository {
    if (this.isDatabaseChanged(db)) {
      this.resetAllInstances();
      this.currentDb = db;
    }

    if (!this.instances.settings) {
      console.log(
        "[RepositoryFactory] Creating new SettingsRepository instance",
      );
      this.instances.settings = new SettingsRepository(db);
    }

    return this.instances.settings;
  }

  /**
   * トークンリポジトリを取得
   */
  public static getTokenRepository(db: SqliteManager): TokenRepository {
    if (this.isDatabaseChanged(db)) {
      this.resetAllInstances();
      this.currentDb = db;
    }

    if (!this.instances.token) {
      console.log("[RepositoryFactory] Creating new TokenRepository instance");
      this.instances.token = new TokenRepository(db);
    }

    return this.instances.token;
  }

  /**
   * ワークスペースリポジトリを取得
   */
  public static getWorkspaceRepository(db: SqliteManager): WorkspaceRepository {
    if (this.isDatabaseChanged(db)) {
      this.resetAllInstances();
      this.currentDb = db;
    }

    if (!this.instances.workspace) {
      console.log(
        "[RepositoryFactory] Creating new WorkspaceRepository instance",
      );
      this.instances.workspace = new WorkspaceRepository(db);
    }

    return this.instances.workspace;
  }

  /**
   * すべてのリポジトリインスタンスをリセット（外部から呼び出し可能）
   */
  public static reset(): void {
    this.resetAllInstances();
    this.currentDb = null;
  }
}
