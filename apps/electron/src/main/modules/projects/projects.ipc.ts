import { ipcMain } from "electron";
import { getProjectService } from "./projects.service";

export function setupProjectHandlers(): void {
  const service = getProjectService();

  ipcMain.handle("project:list", async () => {
    return service.list();
  });

  ipcMain.handle(
    "project:create",
    async (_evt, input: { name: string; color?: string }) => {
      if (!input || typeof input.name !== "string" || !input.name.trim()) {
        throw new Error("Invalid project name");
      }
      return service.create({ name: input.name, color: input.color });
    },
  );

  ipcMain.handle(
    "project:update",
    async (
      _evt,
      id: string,
      updates: { name?: string; color?: string },
    ) => {
      if (!id) throw new Error("Missing project id");
      const payload: { name?: string; color?: string } = {};
      if (updates?.name !== undefined) payload.name = updates.name;
      if (updates?.color !== undefined) payload.color = updates.color;
      return service.update(id, payload);
    },
  );

  ipcMain.handle("project:delete", async (_evt, id: string) => {
    if (!id) throw new Error("Missing project id");
    service.delete(id);
  });
}

