import { ipcMain } from "electron";
import {
  listMcpApps,
  updateAppServerAccess,
  addApp,
  unifyAppConfig,
  deleteCustomApp,
} from "./mcp-apps-manager.service";

export function setupMcpAppsHandlers(): void {
  ipcMain.handle("mcp-apps:list", async () => {
    try {
      return await listMcpApps();
    } catch (error) {
      console.error("Failed to list MCP apps:", error);
      return [];
    }
  });

  ipcMain.handle("mcp-apps:delete", async (_, appName: string) => {
    try {
      return await deleteCustomApp(appName);
    } catch (error) {
      console.error(`Failed to delete custom app ${appName}:`, error);
      return false;
    }
  });

  ipcMain.handle("mcp-apps:add", async (_, appName: string) => {
    try {
      return await addApp(appName);
    } catch (error) {
      console.error(`Failed to add MCP config to ${appName}:`, error);
      return {
        success: false,
        message: `Error adding MCP configuration to ${appName}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  });

  ipcMain.handle(
    "mcp-apps:update-server-access",
    async (_, appName: string, serverIds: string[]) => {
      try {
        return await updateAppServerAccess(appName, serverIds);
      } catch (error) {
        console.error(`Failed to update server access for ${appName}:`, error);
        return {
          success: false,
          message: `Error updating server access for ${appName}: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  );

  ipcMain.handle("mcp-apps:unify", async (_, appName: string) => {
    try {
      return await unifyAppConfig(appName);
    } catch (error) {
      console.error(`Failed to unify config for ${appName}:`, error);
      return {
        success: false,
        message: `Error unifying configuration for ${appName}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  });
}
