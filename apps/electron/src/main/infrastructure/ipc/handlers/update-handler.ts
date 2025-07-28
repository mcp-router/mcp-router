import { ipcMain, app, autoUpdater } from "electron";
import { mainWindow } from "@/main";

let isUpdateAvailable = false;
let isAutoUpdateInProgress = false;

// Set up autoUpdater event listeners
autoUpdater.on("update-downloaded", () => {
  isUpdateAvailable = true;
  // Notify renderer process about available update
  if (mainWindow) {
    mainWindow.webContents.send("update:downloaded", true);
  }
});

export function setupUpdateHandlers(): void {
  // Handle update checking from renderer
  ipcMain.handle("update:check", () => {
    return {
      updateAvailable: isUpdateAvailable,
    };
  });

  // Handle update installation request from renderer
  ipcMain.handle("update:install", () => {
    if (isUpdateAvailable) {
      isAutoUpdateInProgress = true;
      autoUpdater.quitAndInstall();
      app.quit();
      return true;
    }
    return false;
  });

  // Handle package manager restart request from renderer
  ipcMain.handle("packageManager:restart", () => {
    app.quit();
    return true;
  });

  // Handle system info request
  ipcMain.handle("system:getPlatform", () => {
    return process.platform;
  });
}

export function getIsAutoUpdateInProgress(): boolean {
  return isAutoUpdateInProgress;
}
