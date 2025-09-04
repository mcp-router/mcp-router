import { ipcMain } from "electron";
import {
  listMcpApps,
  updateAppServerAccess,
  addApp,
  unifyAppConfig,
  deleteCustomApp,
} from "@/main/modules/mcp-core/apps/mcp-apps-service";
import { getTokenService } from "@/main/modules/mcp-core/token/token-service";
import { TokenScope } from "@mcp_router/shared";

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

  ipcMain.handle(
    "mcp-apps:updateScopes",
    (_, tokenId: string, scopes: TokenScope[]) => {
      try {
        const tokenService = getTokenService();
        const success = tokenService.updateTokenScopes(tokenId, scopes);

        if (success) {
          // Get the updated token
          const tokens = tokenService.listTokens();
          const token = tokens.find((t: any) => t.id === tokenId);

          // Get the app name from the token client ID (assuming client ID = app name)
          const appName = token?.clientId;

          // Build a basic McpApp object to return
          if (token && appName) {
            return {
              success: true,
              message: "Token scopes updated successfully",
              app: {
                name: appName,
                installed: true,
                configured: true,
                configPath: "", // Required field but we don't have it here
                token: token.id,
                serverIds: token.serverIds,
                scopes: token.scopes,
              },
            };
          }
        }

        return {
          success: false,
          message: "Failed to update token scopes",
        };
      } catch (error: any) {
        console.error("Failed to update token scopes:", error);
        return {
          success: false,
          message: `Error updating token scopes: ${error.message}`,
        };
      }
    },
  );
}
