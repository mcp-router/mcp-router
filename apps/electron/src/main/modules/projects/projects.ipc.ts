import { ipcMain } from "electron";
import { ProjectService, getProjectService } from "./projects.service";
import type { MCPServerManager } from "@/main/modules/mcp-server-manager/mcp-server-manager";

export function setupProjectHandlers(deps: {
  getServerManager: () => MCPServerManager;
}): void {
  ProjectService.setServerManagerProvider(deps.getServerManager);
  const service = getProjectService();

  ipcMain.handle("project:list", async () => {
    return service.list();
  });

  ipcMain.handle("project:create", async (_evt, input: { name: string }) => {
    if (!input || !input.name.trim()) {
      throw new Error("Invalid project name");
    }
    if (/\s/.test(input.name)) {
      throw new Error("Invalid project name: whitespace not allowed");
    }
    return service.create({ name: input.name });
  });

  ipcMain.handle(
    "project:update",
    async (_evt, id: string, updates: { name?: string }) => {
      if (!id) throw new Error("Missing project id");
      const payload: { name?: string } = {};
      if (updates?.name !== undefined) payload.name = updates.name;
      return service.update(id, payload);
    },
  );

  ipcMain.handle("project:delete", async (_evt, id: string) => {
    if (!id) throw new Error("Missing project id");
    service.delete(id);
  });
}
