import { BrowserWindow } from "electron";
import { getWorkspaceService, Workspace } from "./services/workspace-service";

/**
 * Platform API管理クラス
 * ワークスペースに応じてPlatform APIの実装を切り替える
 */
export class PlatformAPIManager {
  private static instance: PlatformAPIManager | null = null;
  private currentWorkspace: Workspace | null = null;
  private mainWindow: BrowserWindow | null = null;

  public static getInstance(): PlatformAPIManager {
    if (!PlatformAPIManager.instance) {
      PlatformAPIManager.instance = new PlatformAPIManager();
    }
    return PlatformAPIManager.instance;
  }

  private constructor() {
    // ワークスペース切り替えイベントをリッスン
    getWorkspaceService().onWorkspaceSwitched((workspace) => {
      this.handleWorkspaceSwitch(workspace);
    });
  }

  /**
   * メインウィンドウを設定
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * 初期化
   */
  async initialize(): Promise<void> {
    // アクティブなワークスペースを取得
    const activeWorkspace = await getWorkspaceService().getActiveWorkspace();
    if (activeWorkspace) {
      this.currentWorkspace = activeWorkspace;
      await this.configureForWorkspace(activeWorkspace);
    } else {
      // デフォルトワークスペースがない場合は作成
      await getWorkspaceService().switchWorkspace("local-default");
    }
  }

  /**
   * ワークスペースに応じた設定を適用
   */
  private async configureForWorkspace(workspace: Workspace): Promise<void> {
    if (workspace.type === "local") {
      // ローカルワークスペースの場合は特別な設定は不要
      // 既存のIPCハンドラーがそのまま使われる
    } else {
      // リモートワークスペースの場合
      // TODO: リモートAPI用の設定を適用
      const credentials = await getWorkspaceService().getWorkspaceCredentials(
        workspace.id,
      );

      // レンダラープロセスにワークスペース情報を送信
      if (this.mainWindow) {
        this.mainWindow.webContents.send("workspace:config-changed", {
          workspace,
          apiUrl: workspace.remoteConfig?.apiUrl,
          hasCredentials: !!credentials,
        });
      }
    }
  }

  /**
   * ワークスペース切り替えハンドラー
   */
  private async handleWorkspaceSwitch(workspace: Workspace): Promise<void> {
    this.currentWorkspace = workspace;
    await this.configureForWorkspace(workspace);

    // レンダラープロセスに通知
    if (this.mainWindow) {
      this.mainWindow.webContents.send("workspace:switched", workspace);
    }
  }

  /**
   * 現在のワークスペースを取得
   */
  getCurrentWorkspace(): Workspace | null {
    return this.currentWorkspace;
  }

  /**
   * 現在のワークスペースがリモートかどうか
   */
  isRemoteWorkspace(): boolean {
    return this.currentWorkspace?.type === "remote";
  }

  /**
   * リモートAPIのベースURLを取得
   */
  getRemoteApiUrl(): string | null {
    if (
      this.isRemoteWorkspace() &&
      this.currentWorkspace?.remoteConfig?.apiUrl
    ) {
      return this.currentWorkspace.remoteConfig.apiUrl;
    }
    return null;
  }
}

/**
 * PlatformAPIManagerのシングルトンインスタンスを取得
 */
export function getPlatformAPIManager(): PlatformAPIManager {
  return PlatformAPIManager.getInstance();
}
