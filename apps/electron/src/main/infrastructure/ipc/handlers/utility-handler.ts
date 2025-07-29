import { ipcMain } from "electron";
import { commandExists } from "@/main/utils/env-utils";

export function setupUtilityHandlers(): void {
  // Check if a command exists in user shell environment
  ipcMain.handle("command:exists", async (_, command: string) => {
    const result = await commandExists(command);
    return result;
  });
}
