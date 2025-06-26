import { BaseService } from "./base-service";
import { Singleton } from "../../lib/utils/backend/singleton";
import {
  WorkspaceRepository,
  getWorkspaceRepository,
} from "../../lib/database";
import { safeStorage, session } from "electron";
import { EventEmitter } from "events";

export interface Workspace {
  id: string;
  name: string;
  type: "local" | "remote";
  isActive: boolean;
  createdAt: Date;
  lastUsedAt: Date;
  remoteConfig?: {
    apiUrl: string;
    authToken?: string;
    teamId?: string;
    userId?: string;
  };
  displayInfo?: {
    avatarUrl?: string;
    email?: string;
    teamName?: string;
  };
}

export interface WorkspaceCreateConfig {
  name: string;
  type: "local" | "remote";
  remoteConfig?: {
    apiUrl: string;
    authToken?: string;
    teamId?: string;
  };
}

export class WorkspaceService
  extends BaseService<Workspace, string>
  implements Singleton<WorkspaceService>
{
  private static instance: WorkspaceService | null = null;
  private electronSessions: Map<string, Electron.Session> = new Map();
  private repository: WorkspaceRepository;
  private eventEmitter: EventEmitter = new EventEmitter();

  public static getInstance(): WorkspaceService {
    if (!WorkspaceService.instance) {
      WorkspaceService.instance = new WorkspaceService();
    }
    return WorkspaceService.instance;
  }

  private constructor() {
    super();
    this.repository = getWorkspaceRepository();
  }

  protected getEntityName(): string {
    return "ワークスペース";
  }

  /**
   * ワークスペース一覧を取得
   */
  async list(): Promise<Workspace[]> {
    try {
      return this.repository.getAll();
    } catch (error) {
      return this.handleError("一覧取得", error, []);
    }
  }

  /**
   * ワークスペースをIDで取得
   */
  async findById(id: string): Promise<Workspace | null> {
    try {
      const workspace = this.repository.getById(id);
      return workspace || null;
    } catch (error) {
      return this.handleError("取得", error, null);
    }
  }

  /**
   * 新しいワークスペースを作成
   */
  async create(config: WorkspaceCreateConfig): Promise<Workspace> {
    try {
      const workspace: Workspace = {
        id: `workspace-${Date.now()}`,
        name: config.name,
        type: config.type,
        isActive: false,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        remoteConfig: config.remoteConfig,
      };

      // リモートワークスペースの場合、認証トークンを暗号化
      if (config.type === "remote" && config.remoteConfig?.authToken) {
        await this.saveWorkspaceCredentials(
          workspace.id,
          config.remoteConfig.authToken,
        );
        // 元のトークンは保存しない
        workspace.remoteConfig!.authToken = undefined;
      }

      return this.repository.add(workspace);
    } catch (error) {
      return this.handleError("作成", error);
    }
  }

  /**
   * ワークスペースを更新
   */
  async update(id: string, updates: Partial<Workspace>): Promise<void> {
    try {
      // 認証トークンが含まれている場合は暗号化
      if (updates.remoteConfig?.authToken) {
        await this.saveWorkspaceCredentials(id, updates.remoteConfig.authToken);
        updates.remoteConfig.authToken = undefined;
      }

      this.repository.update(id, updates);
    } catch (error) {
      this.handleError("更新", error);
    }
  }

  /**
   * ワークスペースを削除
   */
  async delete(id: string): Promise<void> {
    try {
      const workspace = await this.findById(id);
      if (!workspace) {
        throw new Error("ワークスペースが見つかりません");
      }

      if (workspace.type === "local" && workspace.id === "local-default") {
        throw new Error("デフォルトのローカルワークスペースは削除できません");
      }

      if (workspace.isActive) {
        // アクティブなワークスペースを削除する場合は、デフォルトに切り替え
        await this.switchWorkspace("local-default");
      }

      this.repository.delete(id);

      // セッションの削除
      if (this.electronSessions.has(id)) {
        this.electronSessions.delete(id);
      }
    } catch (error) {
      this.handleError("削除", error);
    }
  }

  /**
   * アクティブなワークスペースを取得
   */
  async getActiveWorkspace(): Promise<Workspace | null> {
    try {
      return this.repository.getActiveWorkspace();
    } catch (error) {
      return this.handleError("アクティブワークスペース取得", error, null);
    }
  }

  /**
   * 認証情報の暗号化保存
   */
  private async saveWorkspaceCredentials(
    workspaceId: string,
    token: string,
  ): Promise<void> {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(token);
      await this.repository.updateCredentials(workspaceId, encrypted);
    } else {
      throw new Error("暗号化が利用できません");
    }
  }

  /**
   * 認証情報の復号化取得
   */
  async getWorkspaceCredentials(workspaceId: string): Promise<string | null> {
    try {
      const encryptedToken = await this.repository.getCredentials(workspaceId);
      if (encryptedToken && safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(Buffer.from(encryptedToken, "base64"));
      }
      return null;
    } catch (error) {
      return this.handleError("認証情報取得", error, null);
    }
  }

  /**
   * セッションの分離
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
   * ワークスペース切り替え
   */
  async switchWorkspace(workspaceId: string): Promise<void> {
    try {
      const workspace = await this.findById(workspaceId);
      if (!workspace) {
        throw new Error("ワークスペースが見つかりません");
      }

      await this.repository.setActiveWorkspace(workspaceId);

      // イベントを発火して、Platform APIの切り替えをトリガー
      this.eventEmitter.emit("workspace-switched", workspace);
    } catch (error) {
      this.handleError("切り替え", error);
    }
  }

  /**
   * ワークスペース切り替えイベントのリスナー登録
   */
  onWorkspaceSwitched(callback: (workspace: Workspace) => void): void {
    this.eventEmitter.on("workspace-switched", callback);
  }

  /**
   * ワークスペース切り替えイベントのリスナー解除
   */
  offWorkspaceSwitched(callback: (workspace: Workspace) => void): void {
    this.eventEmitter.off("workspace-switched", callback);
  }
}

/**
 * WorkspaceServiceのシングルトンインスタンスを取得
 */
export function getWorkspaceService(): WorkspaceService {
  return WorkspaceService.getInstance();
}
