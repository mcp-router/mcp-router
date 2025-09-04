import { app, Menu, Tray, nativeImage } from "electron";
import { MCPServerManager } from "@/main/modules/mcp-server-manager/mcp-server-manager";
import { mainWindow } from "../../main";

// Global tray instance
let tray: Tray | null = null;

/**
 * Creates the system tray icon and menu
 * @param serverManager The MCPServerManager instance to get server info
 */
export function createTray(serverManager: MCPServerManager): Tray | null {
  try {
    // Create tray instance - if no icon is found, use a simple fallback
    const icon = nativeImage.createFromDataURL(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAA3GVYSWZNTQAqAAAACAAGARIAAwAAAAEAAQAAARoABQAAAAEAAABWARsABQAAAAEAAABeATEAAgAAAEMAAABmATsAAgAAAAcAAACqh2kABAAAAAEAAACyAAAAAAAAAGAAAAABAAAAYAAAAAFDYW52YSBkb2M9REFHaDN4MnVSdzggdXNlcj1VQUZkdXhRaHFSOCBicmFuZD1CQUZkdTdfX0xrMCB0ZW1wbGF0ZT0AAFl1a2kgRgAAAAOgAQADAAAAAQABAACgAgAEAAAAAQAAABagAwAEAAAAAQAAABYAAAAAtdBixAAAAAlwSFlzAAAOxAAADsQBlSsOGwAABnFpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IlhNUCBDb3JlIDYuMC4wIj4KICAgPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICAgICAgPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIKICAgICAgICAgICAgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIgogICAgICAgICAgICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgICAgICAgICAgIHhtbG5zOmV4aWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vZXhpZi8xLjAvIgogICAgICAgICAgICB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyIKICAgICAgICAgICAgeG1sbnM6QXR0cmliPSJodHRwOi8vbnMuYXR0cmlidXRpb24uY29tL2Fkcy8xLjAvIj4KICAgICAgICAgPHhtcDpDcmVhdG9yVG9vbD5DYW52YSBkb2M9REFHaDN4MnVSdzggdXNlcj1VQUZkdXhRaHFSOCBicmFuZD1CQUZkdTdfX0xrMCB0ZW1wbGF0ZT08L3htcDpDcmVhdG9yVG9vbD4KICAgICAgICAgPGRjOmNyZWF0b3I+CiAgICAgICAgICAgIDxyZGY6U2VxPgogICAgICAgICAgICAgICA8cmRmOmxpPll1a2kgRjwvcmRmOmxpPgogICAgICAgICAgICA8L3JkZjpTZXE+CiAgICAgICAgIDwvZGM6Y3JlYXRvcj4KICAgICAgICAgPGRjOnRpdGxlPgogICAgICAgICAgICA8cmRmOkFsdD4KICAgICAgICAgICAgICAgPHJkZjpsaSB4bWw6bGFuZz0ieC1kZWZhdWx0Ij7nlJjlhZogLSAzPC9yZGY6bGk+CiAgICAgICAgICAgIDwvcmRmOkFsdD4KICAgICAgICAgPC9kYzp0aXRsZT4KICAgICAgICAgPGV4aWY6UGl4ZWxYRGltZW5zaW9uPjIwMDwvZXhpZjpQaXhlbFhEaW1lbnNpb24+CiAgICAgICAgIDxleGlmOkNvbG9yU3BhY2U+MTwvZXhpZjpDb2xvclNwYWNlPgogICAgICAgICA8ZXhpZjpQaXhlbFlEaW1lbnNpb24+MjAwPC9leGlmOlBpeGVsWURpbWVuc2lvbj4KICAgICAgICAgPHRpZmY6WFJlc29sdXRpb24+OTY8L3RpZmY6WFJlc29sdXRpb24+CiAgICAgICAgIDx0aWZmOllSZXNvbHV0aW9uPjk2PC90aWZmOllSZXNvbHV0aW9uPgogICAgICAgICA8dGlmZjpPcmllbnRhdGlvbj4xPC90aWZmOk9yaWVudGF0aW9uPgogICAgICAgICA8QXR0cmliOkFkcz4KICAgICAgICAgICAgPHJkZjpTZXE+CiAgICAgICAgICAgICAgIDxyZGY6bGkgcmRmOnBhcnNlVHlwZT0iUmVzb3VyY2UiPgogICAgICAgICAgICAgICAgICA8QXR0cmliOlRvdWNoVHlwZT4yPC9BdHRyaWI6VG91Y2hUeXBlPgogICAgICAgICAgICAgICAgICA8QXR0cmliOkNyZWF0ZWQ+MjAyNS0wMy0yMjwvQXR0cmliOkNyZWF0ZWQ+CiAgICAgICAgICAgICAgICAgIDxBdHRyaWI6RXh0SWQ+MjRjZjQxMjQtYTEwNS00N2E0LWI4ZGItMzk2NDI1NjM0NTAyPC9BdHRyaWI6RXh0SWQ+CiAgICAgICAgICAgICAgICAgIDxBdHRyaWI6RmJJZD41MjUyNjU5MTQxNzk1ODA8L0F0dHJpYjpGYklkPgogICAgICAgICAgICAgICA8L3JkZjpsaT4KICAgICAgICAgICAgPC9yZGY6U2VxPgogICAgICAgICA8L0F0dHJpYjpBZHM+CiAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgr9WXAaAAAEMklEQVQ4EbVVSWybVRD+/s1bamezk2ax2yZNFWiD2tCqCNEGISEgqioOlaqAOMABgRAXbpyo4Ia4IaFcygUKFCkFtYdCi5CihpZuQpEiSimLsrjxUhzvju3f/vnmJQ5JCtw6sq158958b97MN2MNoxMOHoDoDwBTQZr/Bayt29j8pP/ba7jdByxODpEc+VFCC9+l7KsWp76qgGc0TT6ibZANwAa3ajwRsjRs9RioUxeHaKmGTI0KAbbwkkiTTlWDzvViqY57tgODuhxpyBow7Qo0aGpIpmwkp8q00Mo1RlzweXTYtOTLDn7+rggsy5X8PuFGsNVU4OsjXwOWl/e4NEQTNsYOBvDMm53IF23UanWcuRTHZLQC8EkHghZe/DAM09TR5DNx4Uocn1/LoidkIlohiERIUcCiy/2SBng1/JWzMbCjFY8f2EYDsDU4g8m3ZpTT6+/14eWxfcp++fosPvt2AfBoK760NrAU3QRP8hUr1zHEiC6cXMKps78hnszDZsQHh3sAHw+EdDy8qx3ZnKQJGD99Gxc/zmB3u6V8BUOwRP5Jhay4U2IhEDbQH25CIplDaqmAh3Z1YmTYh51dHlimgehiGgF/J3o7PMCQiaL40LcBqqDkZ01W9lkhh5E6ihWTV+bV9rGRThwaDuFuPId8gfmmVCrkHYspkW5A5fLfO0+u5tdlGTh5PsoFMPpUPx4ZDOHSjZjiudicVTTBbRRNVJH7gFUBAxoMElMqf+N0HjO3Yujb3o6WZi/e/zKuLhRn06A7C1cVwm+SDcAaVwFSDnM20rkqdPXGAq5PLyq32YUlYDoFXbqBkspWgZka2snxxjNWdoSZO4+fcNGuIk3XEItX8cpLIbw2thv9jLI9XMf5ywkceTKCL87exv5DbTg2OgiLadrR7cXvpRSmPskCAy7VfSp4omsdR884CfbrtlYDJ45vx/i5eVxNVPHOsx0olWx2Wg0fXc3g+X4vvp4u4OlBL3rbLKQLNewd8KsLhvcEkUqX8cIHv/DJBlrINS1wZMKR8DM3y/jm1KNsXQuHX73GJ5bUc1UZIpZiSuSwF/u63Bjq82NooBUdIR9cpN+f82lMfB/FV3dK2OLWUCRZNDw34US4mGMaQMPFd/eircWrDhdKVdRp87gNNPs5L7wW3C4T5YqN+bs5/PBTEuOfJlkT5voxD/xBE7nVYaXp/AepMzERFmBOrL9W8fYb3djDiLwek8AOlpmOpcwyZheLmLqVxY9kCmyOpLCFnmEPunwGYsUaFjgrGoNIk78maT+bAL1uHcuM8N45Ti/hKNeKqjJclMKk7bfQ1WOh26ejVHXwB8fm8mrnNUAlhwpYlMYsbqYSZgQV0iRNR0KjiaPTQ4pJLaR9Y+w4BrgiPCBnGM8GWZsVKjX0zPBERlJCnalXEpOI1vcA7cJ5ETFvBhX739yJnjTInPIjAAAAAElFTkSuQmCC",
    );

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
