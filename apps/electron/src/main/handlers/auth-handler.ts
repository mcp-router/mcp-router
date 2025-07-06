import { ipcMain } from "electron";
import { handleAuthToken, logout, startAuthFlow, status } from "../auth";
import { mainWindow } from "../../main";

/**
 * 認証関連のIPC通信ハンドラをセットアップ
 */
export function setupAuthHandlers(): void {
  ipcMain.handle("auth:login", (_, idp?: string) => {
    startAuthFlow(idp);
    return true;
  });

  ipcMain.handle("auth:logout", () => {
    const result = logout();
    // Status change is now handled directly in the logout function
    return result;
  });

  ipcMain.handle("auth:status", async () => {
    const result = await status();
    // Notifying renderer about auth status
    if (mainWindow) {
      mainWindow.webContents.send("auth:status-changed", {
        loggedIn: result.authenticated,
        userId: result.userId || "",
        user: result.user || null,
      });
    }

    return result;
  });

  ipcMain.handle("auth:handle-token", (_, token: string, state?: string) => {
    handleAuthToken(token, state);
    return true;
  });
}
