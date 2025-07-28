import { ipcMain } from "electron";
import { commandExists } from "@/lib/get-env";

export function setupUtilityHandlers(): void {
  // Check if a command exists in user shell environment
  ipcMain.handle("command:exists", async (_, command: string) => {
    const result = await commandExists(command);
    return result;
  });
}
