import { ipcMain } from "electron";
import { MCPHook } from "@mcp_router/shared";
import { getHookRepository } from "@/main/infrastructure/database";
import { getHookService } from "@/main/domain/mcp-core/hook/hook-service";
import { v4 as uuidv4 } from "uuid";

export function setupHookHandlers(): void {
  /**
   * List all hooks
   */
  ipcMain.handle("hook:list", async () => {
    try {
      const hookRepository = getHookRepository();
      return await hookRepository.listHooks();
    } catch (error) {
      console.error("Failed to list hooks:", error);
      throw error;
    }
  });

  /**
   * Get a specific hook by ID
   */
  ipcMain.handle("hook:get", async (_, id: string) => {
    try {
      const hookRepository = getHookRepository();
      return await hookRepository.getHook(id);
    } catch (error) {
      console.error(`Failed to get hook ${id}:`, error);
      throw error;
    }
  });

  /**
   * Create a new hook
   */
  ipcMain.handle(
    "hook:create",
    async (_, hookData: Omit<MCPHook, "id" | "createdAt" | "updatedAt">) => {
      try {
        const hook: MCPHook = {
          ...hookData,
          id: uuidv4(),
          executionOrder: hookData.executionOrder ?? 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const hookRepository = getHookRepository();
        await hookRepository.upsertHook(hook);

        // Reload hooks in the service
        const hookService = getHookService();
        hookService.reloadHooks();

        return hook;
      } catch (error) {
        console.error("Failed to create hook:", error);
        throw error;
      }
    },
  );

  /**
   * Update an existing hook
   */
  ipcMain.handle(
    "hook:update",
    async (
      _,
      id: string,
      updates: Partial<Omit<MCPHook, "id" | "createdAt" | "updatedAt">>,
    ) => {
      try {
        const hookRepository = getHookRepository();
        await hookRepository.updateHook(id, updates);

        // Reload hooks in the service
        const hookService = getHookService();
        hookService.reloadHooks();

        return await hookRepository.getHook(id);
      } catch (error) {
        console.error(`Failed to update hook ${id}:`, error);
        throw error;
      }
    },
  );

  /**
   * Delete a hook
   */
  ipcMain.handle("hook:delete", async (_, id: string) => {
    try {
      const hookRepository = getHookRepository();
      await hookRepository.deleteHook(id);

      // Reload hooks in the service
      const hookService = getHookService();
      hookService.reloadHooks();

      return true;
    } catch (error) {
      console.error(`Failed to delete hook ${id}:`, error);
      throw error;
    }
  });

  /**
   * Enable/disable a hook
   */
  ipcMain.handle("hook:setEnabled", async (_, id: string, enabled: boolean) => {
    try {
      const hookRepository = getHookRepository();
      await hookRepository.updateHook(id, { enabled });

      // Reload hooks in the service
      const hookService = getHookService();
      hookService.reloadHooks();

      return await hookRepository.getHook(id);
    } catch (error) {
      console.error(
        `Failed to ${enabled ? "enable" : "disable"} hook ${id}:`,
        error,
      );
      throw error;
    }
  });

  /**
   * Reorder hooks
   */
  ipcMain.handle("hook:reorder", async (_, hookIds: string[]) => {
    try {
      const hookRepository = getHookRepository();
      await hookRepository.reorderHooks(hookIds);

      // Reload hooks in the service
      const hookService = getHookService();
      hookService.reloadHooks();

      return await hookRepository.listHooks();
    } catch (error) {
      console.error("Failed to reorder hooks:", error);
      throw error;
    }
  });
}
