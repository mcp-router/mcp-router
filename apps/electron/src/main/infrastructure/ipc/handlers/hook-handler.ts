import { ipcMain } from "electron";
import { MCPHook, HookContext } from "@mcp_router/shared";
import { DatabaseService } from "@/main/infrastructure/database";
import { HookRepository } from "@/main/infrastructure/database/repositories/hook/hook-repository";
import { RepositoryFactory } from "@/main/infrastructure/database/factories/repository-factory";
import { v4 as uuidv4 } from "uuid";

export function setupHookHandlers(databaseService: DatabaseService): void {
  const hookRepository = RepositoryFactory.getHookRepository(databaseService);
  const getMCPServerManager = () => (global as any).getMCPServerManager();

  /**
   * List all hooks
   */
  ipcMain.handle("hook:list", async () => {
    try {
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

        await hookRepository.upsertHook(hook);

        // Reload hooks in the manager
        const mcpServerManager = getMCPServerManager();
        // Access hookManager through aggregatorServer's requestHandlers
        const aggregatorServer = mcpServerManager.getAggregatorServer();
        if (aggregatorServer) {
          // hookManager is private, so we need to reload hooks differently
          // For now, just log that hooks need to be reloaded
          console.log(
            "Hooks updated - restart may be required for changes to take effect",
          );
        }

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
        await hookRepository.updateHook(id, updates);

        // Reload hooks in the manager
        const mcpServerManager = getMCPServerManager();
        // Access hookManager through aggregatorServer's requestHandlers
        const aggregatorServer = mcpServerManager.getAggregatorServer();
        if (aggregatorServer) {
          // hookManager is private, so we need to reload hooks differently
          // For now, just log that hooks need to be reloaded
          console.log(
            "Hooks updated - restart may be required for changes to take effect",
          );
        }

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
      await hookRepository.deleteHook(id);

      // Reload hooks in the manager
      const mcpServerManager = getMCPServerManager();
      // Access hookManager through aggregatorServer's requestHandlers
      const aggregatorServer = mcpServerManager.getAggregatorServer();
      if (aggregatorServer) {
        // hookManager is private, so we need to reload hooks differently
        // For now, just log that hooks need to be reloaded
        console.log(
          "Hooks updated - restart may be required for changes to take effect",
        );
      }

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
      await hookRepository.updateHook(id, { enabled });

      // Reload hooks in the manager
      const mcpServerManager = getMCPServerManager();
      // Access hookManager through aggregatorServer's requestHandlers
      const aggregatorServer = mcpServerManager.getAggregatorServer();
      if (aggregatorServer) {
        // hookManager is private, so we need to reload hooks differently
        // For now, just log that hooks need to be reloaded
        console.log(
          "Hooks updated - restart may be required for changes to take effect",
        );
      }

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
      await hookRepository.reorderHooks(hookIds);

      // Reload hooks in the manager
      const mcpServerManager = getMCPServerManager();
      // Access hookManager through aggregatorServer's requestHandlers
      const aggregatorServer = mcpServerManager.getAggregatorServer();
      if (aggregatorServer) {
        // hookManager is private, so we need to reload hooks differently
        // For now, just log that hooks need to be reloaded
        console.log(
          "Hooks updated - restart may be required for changes to take effect",
        );
      }

      return await hookRepository.listHooks();
    } catch (error) {
      console.error("Failed to reorder hooks:", error);
      throw error;
    }
  });

  /**
   * Test a hook with sample context
   */
  ipcMain.handle("hook:test", async (_, id: string, context: HookContext) => {
    try {
      // For now, we can't test hooks directly through IPC
      // This would require exposing the hookManager in the MCPServerManager
      throw new Error("Hook testing is not yet implemented through IPC");
    } catch (error) {
      console.error(`Failed to test hook ${id}:`, error);
      throw error;
    }
  });
}
