import { ipcMain } from "electron";
import { getWorkspaceService } from "../../../domain/workspace/workspace-service";
import type { WorkspaceCreateConfig } from "@mcp_router/shared";

/**
 * ワークスペース関連のIPCハンドラーを登録
 */
export function setupWorkspaceHandlers(): void {
  // ワークスペース一覧取得
  ipcMain.handle("workspace:list", async () => {
    return getWorkspaceService().list();
  });

  // ワークスペース作成
  ipcMain.handle(
    "workspace:create",
    async (_, config: WorkspaceCreateConfig) => {
      return getWorkspaceService().create(config);
    },
  );

  // ワークスペース更新
  ipcMain.handle("workspace:update", async (_, id: string, updates: any) => {
    await getWorkspaceService().update(id, updates);
    return { success: true };
  });

  // ワークスペース削除
  ipcMain.handle("workspace:delete", async (_, id: string) => {
    await getWorkspaceService().delete(id);
    return { success: true };
  });

  // ワークスペース切り替え
  ipcMain.handle("workspace:switch", async (_, workspaceId: string) => {
    await getWorkspaceService().switchWorkspace(workspaceId);

    // Platform APIマネージャーがワークスペース切り替えイベントをリッスンしているため、
    // 自動的にPlatform APIの再初期化が行われる

    return { success: true };
  });

  // 現在のワークスペース取得
  ipcMain.handle("workspace:current", async () => {
    return getWorkspaceService().getActiveWorkspace();
  });

  // ワークスペース認証情報取得（復号化）
  ipcMain.handle(
    "workspace:get-credentials",
    async (_, workspaceId: string) => {
      const token =
        await getWorkspaceService().getWorkspaceCredentials(workspaceId);
      return { token };
    },
  );
}
