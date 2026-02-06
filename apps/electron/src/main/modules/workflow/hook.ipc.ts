import { ipcMain } from "electron";
import { getHookService } from "@/main/modules/workflow/hook.service";
import type { HookModule } from "@mcp_router/shared";

/**
 * Register IPC handlers for Hook Modules
 */
export function setupHookHandlers(): void {
  // Get Hook Module list
  ipcMain.handle("hook-module:list", async () => {
    try {
      return await getHookService().getAllHookModules();
    } catch (error) {
      console.error("Failed to list hook modules:", error);
      throw error;
    }
  });

  // Get Hook Module
  ipcMain.handle("hook-module:get", async (_, id: string) => {
    try {
      return await getHookService().getHookModuleById(id);
    } catch (error) {
      console.error("Failed to get hook module:", error);
      throw error;
    }
  });

  // Create Hook Module
  ipcMain.handle(
    "hook-module:create",
    async (_, module: Omit<HookModule, "id">) => {
      try {
        return await getHookService().createHookModule(module);
      } catch (error) {
        console.error("Failed to create hook module:", error);
        throw error;
      }
    },
  );

  // Update Hook Module
  ipcMain.handle(
    "hook-module:update",
    async (_, id: string, updates: Partial<Omit<HookModule, "id">>) => {
      try {
        return await getHookService().updateHookModule(id, updates);
      } catch (error) {
        console.error("Failed to update hook module:", error);
        throw error;
      }
    },
  );

  // Delete Hook Module
  ipcMain.handle("hook-module:delete", async (_, id: string) => {
    try {
      return await getHookService().deleteHookModule(id);
    } catch (error) {
      console.error("Failed to delete hook module:", error);
      throw error;
    }
  });

  // Execute Hook Module (for testing)
  ipcMain.handle("hook-module:execute", async (_, id: string, context: any) => {
    try {
      return await getHookService().executeHookModule(id, context);
    } catch (error) {
      console.error("Failed to execute hook module:", error);
      throw error;
    }
  });

  // Import Hook Module
  ipcMain.handle(
    "hook-module:import",
    async (_, module: Omit<HookModule, "id">) => {
      try {
        return await getHookService().importHookModule(module);
      } catch (error) {
        console.error("Failed to import hook module:", error);
        throw error;
      }
    },
  );

  // Validate Hook Module
  ipcMain.handle("hook-module:validate", async (_, script: string) => {
    try {
      return await getHookService().validateHookScript(script);
    } catch (error) {
      console.error("Failed to validate hook script:", error);
      throw error;
    }
  });
}
