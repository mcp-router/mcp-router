import { ipcMain } from "electron";
import { getSkillService } from "./skills.service";
import type { CreateSkillInput, UpdateSkillInput } from "@mcp_router/shared";

/**
 * Setup IPC handlers for skills management
 */
export function setupSkillHandlers(): void {
  const service = getSkillService();

  // CRUD operations
  ipcMain.handle("skill:list", async () => {
    return service.list();
  });

  ipcMain.handle("skill:create", async (_evt, input: CreateSkillInput) => {
    if (!input || !input.name?.trim()) {
      throw new Error("Invalid skill name");
    }
    return service.create(input);
  });

  ipcMain.handle(
    "skill:update",
    async (_evt, id: string, updates: UpdateSkillInput) => {
      if (!id) throw new Error("Missing skill id");
      return service.update(id, updates);
    },
  );

  ipcMain.handle("skill:delete", async (_evt, id: string) => {
    if (!id) throw new Error("Missing skill id");
    service.delete(id);
  });

  // Actions
  ipcMain.handle("skill:openFolder", async (_evt, id?: string) => {
    service.openFolder(id);
  });

  ipcMain.handle("skill:import", async () => {
    return service.import();
  });
}
