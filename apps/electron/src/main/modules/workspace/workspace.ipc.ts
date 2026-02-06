import { ipcMain } from "electron";
import { getWorkspaceService } from "@/main/modules/workspace/workspace.service";
import type { WorkspaceCreateConfig } from "@mcp_router/shared";

/**
 * Register IPC handlers for workspaces
 */
export function setupWorkspaceHandlers(): void {
  // Get workspace list
  ipcMain.handle("workspace:list", async () => {
    return getWorkspaceService().list();
  });

  // Create workspace
  ipcMain.handle(
    "workspace:create",
    async (_, config: WorkspaceCreateConfig) => {
      return getWorkspaceService().create(config);
    },
  );

  // Update workspace
  ipcMain.handle("workspace:update", async (_, id: string, updates: any) => {
    await getWorkspaceService().update(id, updates);
    return { success: true };
  });

  // Delete workspace
  ipcMain.handle("workspace:delete", async (_, id: string) => {
    await getWorkspaceService().delete(id);
    return { success: true };
  });

  // Switch workspace
  ipcMain.handle("workspace:switch", async (_, workspaceId: string) => {
    await getWorkspaceService().switchWorkspace(workspaceId);

    // The Platform API Manager listens for workspace switch events,
    // so Platform API re-initialization happens automatically

    return { success: true };
  });

  // Get current workspace
  ipcMain.handle("workspace:current", async () => {
    return getWorkspaceService().getActiveWorkspace();
  });

  // Get workspace credentials (decrypted)
  ipcMain.handle(
    "workspace:get-credentials",
    async (_, workspaceId: string) => {
      const token =
        await getWorkspaceService().getWorkspaceCredentials(workspaceId);
      return { token };
    },
  );
}
