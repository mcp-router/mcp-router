import { app, Menu, Tray, nativeImage, type NativeImage } from "electron";
import { MCPServerManager } from "@/main/modules/mcp-server-manager/mcp-server-manager";
import { mainWindow } from "../../main";

// Global tray instance
let tray: Tray | null = null;

function normalizeTrayIcon(image: NativeImage): NativeImage {
  const size = process.platform === "darwin" ? 20 : 16;
  const resized = image.resize({
    width: size,
    height: size,
    quality: "best",
  });

  if (process.platform === "darwin") {
    resized.setTemplateImage(true);
  }

  return resized;
}

function getTrayIcon(): NativeImage {
  const image = nativeImage.createFromDataURL(
    "data:image/png;base64,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",
  );

  return normalizeTrayIcon(image);
}

/**
 * Creates the system tray icon and menu
 * @param serverManager The MCPServerManager instance to get server info
 */
export function createTray(serverManager: MCPServerManager): Tray | null {
  try {
    const icon = getTrayIcon();

    tray = new Tray(icon);
    tray.setToolTip("MCP Router");
  } catch (error) {
    console.error("Failed to create tray with icon, using default:", error);
    // As a last resort, use a system standard icon
    tray = new Tray(app.getPath("exe"));
    tray.setToolTip("MCP Router");
  }

  // Set tray context menu
  updateTrayContextMenu(serverManager);

  // Add click handlers for tray
  if (process.platform === "darwin") {
    // On macOS, single-click will show the context menu
    // and double-click opens the main window
    tray.on("double-click", () => {
      if (app.dock) {
        app.dock.show();
      }

      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      } else {
        createOrShowMainWindow();
      }
    });

    // Single-click shows context menu on macOS
    tray.on("click", () => {
      tray?.popUpContextMenu();
    });
  } else {
    // On Windows/Linux, right-click will show the context menu (default)
    // Left-click will also show the context menu instead of opening window
    tray.on("click", () => {
      tray?.popUpContextMenu();
    });
  }

  return tray;
}

/**
 * Updates the tray context menu based on current server status
 * @param serverManager The MCPServerManager instance to get server info
 */
export function updateTrayContextMenu(serverManager: MCPServerManager): void {
  if (!tray) return;

  // Get all servers and filter to running ones
  const allServers = serverManager.getServers();
  const runningServers = allServers.filter(
    (server) => server.status === "running",
  );

  const runningServerMenuItems = runningServers.map((server) => {
    return {
      label: server.name,
      enabled: false, // Just display the name, not clickable
    };
  });

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "MCP Router",
      click: () => {
        // Show the app in the Dock on macOS when clicked from context menu
        if (process.platform === "darwin" && app.dock) {
          app.dock.show();
        }

        createOrShowMainWindow();
      },
    },
    { type: "separator" as const },
    ...(runningServerMenuItems.length > 0
      ? [
          { label: "Running Servers:", enabled: false },
          ...runningServerMenuItems,
          { type: "separator" as const },
        ]
      : []),
    {
      label: "Quit",
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

/**
 * Helper function to create or show the main window
 */
function createOrShowMainWindow(): void {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  } else {
    // We need to rely on the caller to create a new window if one doesn't exist
    // as we don't have access to the createWindow function here
    console.log("No main window found to show");
  }
}
