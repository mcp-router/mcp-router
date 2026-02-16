import { ipcMain } from "electron";
import { getSkillService } from "./skills.service";
import type {
  CreateSkillInput,
  UpdateSkillInput,
  CreateAgentPathInput,
} from "@mcp_router/shared";

/**
 * Setup IPC handlers for skills management
 */
export function setupSkillHandlers(): void {
  const service = getSkillService();

  // CRUD operations
  ipcMain.handle("skill:list", async () => {
    return service.list();
  });

  ipcMain.handle("skill:get", async (_evt, id: string) => {
    if (!id) throw new Error("Missing skill id");
    return service.get(id);
  });

  ipcMain.handle("skill:getContent", async (_evt, id: string) => {
    if (!id) throw new Error("Missing skill id");
    return service.getContent(id);
  });

  ipcMain.handle("skill:getWithContent", async (_evt, id: string) => {
    if (!id) throw new Error("Missing skill id");
    return service.getWithContent(id);
  });

  ipcMain.handle(
    "skill:getContentFromPath",
    async (_evt, skillPath: string) => {
      if (!skillPath) throw new Error("Missing skill path");
      return service.getContentFromPath(skillPath);
    },
  );

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
    await service.delete(id);
  });

  // Actions
  ipcMain.handle("skill:openFolder", async (_evt, id?: string) => {
    service.openFolder(id);
  });

  ipcMain.handle("skill:import", async () => {
    return service.import();
  });

  // Agent Path operations
  ipcMain.handle("skill:listAgentPaths", async () => {
    return service.listAgentPaths();
  });

  ipcMain.handle(
    "skill:createAgentPath",
    async (_evt, input: CreateAgentPathInput) => {
      if (!input || !input.name?.trim()) {
        throw new Error("Invalid agent path name");
      }
      if (!input.path?.trim()) {
        throw new Error("Invalid agent path");
      }
      return service.createAgentPath(input);
    },
  );

  ipcMain.handle("skill:deleteAgentPath", async (_evt, id: string) => {
    if (!id) throw new Error("Missing agent path id");
    await service.deleteAgentPath(id);
  });

  ipcMain.handle("skill:selectAgentPathFolder", async () => {
    return service.selectAgentPathFolder();
  });
}
