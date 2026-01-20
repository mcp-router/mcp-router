import { ipcMain, BrowserWindow } from "electron";
import { getConsoleService, ConsoleLogEntry } from "./mcp-server-console.service";

// Store handlers for each webContents to avoid duplicate subscriptions
const handlerMap = new Map<number, Map<string | undefined, (logEntry: ConsoleLogEntry) => void>>();

/**
 * Setup IPC handlers for console log management
 */
export function setupConsoleHandlers(): void {
  // Get console logs for a specific server
  ipcMain.handle("console:getServerLogs", async (_, serverId: string) => {
    try {
      const consoleService = getConsoleService();
      return consoleService.getServerLogs(serverId);
    } catch (error) {
      console.error("Error getting server logs:", error);
      return [];
    }
  });

  // Get console logs for all servers
  ipcMain.handle("console:getAllLogs", async () => {
    try {
      const consoleService = getConsoleService();
      const allLogs = consoleService.getAllLogs();
      // Convert Map to object for IPC
      const logsObject: Record<string, ConsoleLogEntry[]> = {};
      allLogs.forEach((logs, serverId) => {
        logsObject[serverId] = logs;
      });
      return logsObject;
    } catch (error) {
      console.error("Error getting all logs:", error);
      return {};
    }
  });

  // Clear logs for a specific server
  ipcMain.handle("console:clearServerLogs", async (_, serverId: string) => {
    try {
      const consoleService = getConsoleService();
      consoleService.clearServerLogs(serverId);
      return true;
    } catch (error) {
      console.error("Error clearing server logs:", error);
      return false;
    }
  });

  // Clear all logs
  ipcMain.handle("console:clearAllLogs", async () => {
    try {
      const consoleService = getConsoleService();
      consoleService.clearAllLogs();
      return true;
    } catch (error) {
      console.error("Error clearing all logs:", error);
      return false;
    }
  });

  // Subscribe to console log updates via IPC events
  ipcMain.on("console:subscribe", (event, serverId?: string) => {
    try {
      const consoleService = getConsoleService();
      const webContentsId = event.sender.id;
      const channel = serverId ? `console:log:${serverId}` : "console:log";
      const eventName = serverId ? `log:${serverId}` : "log";

      // Check if handler already exists for this webContents and serverId
      if (!handlerMap.has(webContentsId)) {
        handlerMap.set(webContentsId, new Map());
      }

      const handlers = handlerMap.get(webContentsId)!;
      if (handlers.has(serverId)) {
        // Already subscribed, skip
        return;
      }

      const handler = (logEntry: ConsoleLogEntry) => {
        try {
          // Only send if webContents is still valid
          if (!event.sender.isDestroyed()) {
            event.sender.send(channel, logEntry);
          }
        } catch (error) {
          console.error("Error sending console log:", error);
        }
      };

      handlers.set(serverId, handler);
      consoleService.on(eventName, handler);

      // Clean up when renderer disconnects
      event.sender.once("destroyed", () => {
        const handlers = handlerMap.get(webContentsId);
        if (handlers) {
          const handler = handlers.get(serverId);
          if (handler) {
            consoleService.off(eventName, handler);
            handlers.delete(serverId);
          }
          if (handlers.size === 0) {
            handlerMap.delete(webContentsId);
          }
        }
      });
    } catch (error) {
      console.error("Error subscribing to console logs:", error);
    }
  });

  // Unsubscribe from console log updates
  ipcMain.on("console:unsubscribe", (event, serverId?: string) => {
    try {
      const consoleService = getConsoleService();
      const webContentsId = event.sender.id;
      const eventName = serverId ? `log:${serverId}` : "log";

      const handlers = handlerMap.get(webContentsId);
      if (handlers) {
        const handler = handlers.get(serverId);
        if (handler) {
          consoleService.off(eventName, handler);
          handlers.delete(serverId);
        }
        if (handlers.size === 0) {
          handlerMap.delete(webContentsId);
        }
      }
    } catch (error) {
      console.error("Error unsubscribing from console logs:", error);
    }
  });
}
