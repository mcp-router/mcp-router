import { ipcMain, dialog } from "electron";
import type {
  CreateClientAppInput,
  UpdateClientAppInput,
  TokenServerAccess,
} from "@mcp_router/shared";
import { getClientAppService } from "./client-app.service";

/**
 * Setup IPC handlers for client app management
 */
export function setupClientAppHandlers(): void {
  // List all client apps
  ipcMain.handle("client-app:list", async () => {
    try {
      const service = getClientAppService();
      return service.list();
    } catch (error) {
      console.error("Failed to list client apps:", error);
      throw error;
    }
  });

  // Get single client app by ID
  ipcMain.handle("client-app:get", async (_evt, id: string) => {
    try {
      if (!id) {
        throw new Error("Missing client app id");
      }
      const service = getClientAppService();
      return service.get(id);
    } catch (error) {
      console.error(`Failed to get client app ${id}:`, error);
      throw error;
    }
  });

  // Create custom client
  ipcMain.handle(
    "client-app:create",
    async (_evt, input: CreateClientAppInput) => {
      try {
        if (!input || !input.name?.trim()) {
          throw new Error("Invalid client app name");
        }
        const service = getClientAppService();
        return service.create(input);
      } catch (error) {
        console.error("Failed to create client app:", error);
        return {
          success: false,
          message: `Failed to create client app: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  );

  // Update client
  ipcMain.handle(
    "client-app:update",
    async (_evt, id: string, updates: UpdateClientAppInput) => {
      try {
        if (!id) {
          throw new Error("Missing client app id");
        }
        const service = getClientAppService();
        return service.update(id, updates);
      } catch (error) {
        console.error(`Failed to update client app ${id}:`, error);
        return {
          success: false,
          message: `Failed to update client app: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  );

  // Delete custom client
  ipcMain.handle("client-app:delete", async (_evt, id: string) => {
    try {
      if (!id) {
        throw new Error("Missing client app id");
      }
      const service = getClientAppService();
      return service.delete(id);
    } catch (error) {
      console.error(`Failed to delete client app ${id}:`, error);
      return {
        success: false,
        message: `Failed to delete client app: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  });

  // Run auto-detection for installed clients
  ipcMain.handle("client-app:detect", async () => {
    try {
      const service = getClientAppService();
      return service.detectInstalled();
    } catch (error) {
      console.error("Failed to detect client apps:", error);
      throw error;
    }
  });

  // Configure MCP for a client
  ipcMain.handle("client-app:configure", async (_evt, id: string) => {
    try {
      if (!id) {
        throw new Error("Missing client app id");
      }
      const service = getClientAppService();
      return service.configureClient(id);
    } catch (error) {
      console.error(`Failed to configure client app ${id}:`, error);
      return {
        success: false,
        message: `Failed to configure client app: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  });

  // Update server permissions for a client
  ipcMain.handle(
    "client-app:update-server-access",
    async (_evt, id: string, serverAccess: TokenServerAccess) => {
      try {
        if (!id) {
          throw new Error("Missing client app id");
        }
        const service = getClientAppService();
        return service.updateServerAccess(id, serverAccess);
      } catch (error) {
        console.error(`Failed to update server access for ${id}:`, error);
        return {
          success: false,
          message: `Failed to update server access: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  );

  // Open folder picker dialog for custom client paths
  ipcMain.handle("client-app:select-folder", async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ["openDirectory"],
        title: "Select Client Configuration Folder",
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, path: null };
      }

      return { success: true, path: result.filePaths[0] };
    } catch (error) {
      console.error("Failed to open folder picker:", error);
      return {
        success: false,
        path: null,
        message: `Failed to open folder picker: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  });

  // Discover skills from client apps
  ipcMain.handle("client-apps:discover-skills", async () => {
    try {
      const service = getClientAppService();
      return service.discoverSkillsFromClients();
    } catch (error) {
      console.error("Failed to discover skills from clients:", error);
      throw error;
    }
  });
}
