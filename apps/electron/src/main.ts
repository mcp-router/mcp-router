import {
  app,
  autoUpdater,
  BrowserWindow,
  ipcMain,
  session,
  shell,
} from "electron";
import { getSettingsService } from "@/main/services/settings-service";
import path from "node:path";
import { MCPServerManager } from "./main/mcp-server-manager";
import { MCPServerConfig } from "@mcp-router/shared";
import { getTokenService } from "@/main/services/token-service";
import { TokenScope } from "@mcp-router/shared";
import { setEncryptionInitialized } from "./lib/utils/backend/encryption-utils";
import {
  fetchMcpServersFromIndex,
  fetchMcpServerVersionDetails,
} from "./main/mcp-fetcher";
import { MCPHttpServer } from "./main/http/mcp-http-server";
import { logService } from "@/main/services/log-service";
import started from "electron-squirrel-startup";
import {
  listMcpApps,
  updateAppServerAccess,
  addApp,
  unifyAppConfig,
  deleteCustomApp,
} from "@/main/services/mcp-apps-service";
import { updateElectronApp } from "update-electron-app";
import { setApplicationMenu } from "./main/menu";
import { createTray, updateTrayContextMenu } from "./main/tray";
import { importExistingServerConfigurations } from "./main/mcp-config-importer";
import { commandExists } from "./lib/get-env";
import { handleAuthToken, logout, startAuthFlow, status } from "./main/auth";
import { registerPackageVersionHandlers } from "./main/handlers/package-version-handler";
import { registerPackageManagerHandlers } from "./main/handlers/package-manager-handler";
import { setupAgentHandlers } from "./main/handlers/agent-handler";
import { registerWorkspaceHandlers } from "./main/handlers/workspace-handlers";
import { getPlatformAPIManager } from "./main/platform-api-manager";
import { getWorkspaceService } from "./main/services/workspace-service";

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  // If we can't get the lock, it means another instance is running
  // Exit this instance, but the first instance will be notified via second-instance event
  app.exit();
}

// Listen for second instance launches and focus the existing window
app.on("second-instance", (event, commandLine) => {
  // Show the app in the Dock on macOS
  if (process.platform === "darwin" && app.dock) {
    app.dock.show();
  }

  // Focus the existing window
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
  }

  // Check for protocol URLs in the command line arguments
  // Protocol URLs would be the last argument in the command line
  const url = commandLine.find((arg) => arg.startsWith("mcpr://"));
  if (url) {
    handleProtocolUrl(url);
  }
});

// 初回起動時の処理をここでカスタマイズ可能
if (started) app.quit();

// Global references
export let mainWindow: BrowserWindow | null = null;
export let backgroundWindow: BrowserWindow | null = null;
// Flag to track if app.quit() was explicitly called
let isQuitting = false;
// Flag to track if auto-update is in progress
let isAutoUpdateInProgress = false;
// Flag to track if update is available
let isUpdateAvailable = false;
// Timer for updating tray context menu
let trayUpdateTimer: NodeJS.Timeout | null = null;

export const BASE_URL = "https://mcp-router.net/";
// export const BASE_URL = 'http://localhost:3001/';
export const API_BASE_URL = `${BASE_URL}api`;

// Configure auto update
updateElectronApp({
  notifyUser: false,
  updateInterval: "1 hour",
});

// Declare global variables defined by Electron Forge
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string | undefined;
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const BACKGROUND_WINDOW_PRELOAD_WEBPACK_ENTRY: string | undefined;
declare const BACKGROUND_WINDOW_WEBPACK_ENTRY: string;

// グローバル変数の宣言（初期化は後で行う）
let mcpServerManager: MCPServerManager;
let mcpHttpServer: MCPHttpServer;

// MCPServerManagerインスタンスを取得する関数をグローバルに公開
(global as any).getMCPServerManager = () => mcpServerManager;

const createWindow = () => {
  // Platform-specific window options
  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "MCP Router",
    icon: path.join(__dirname, "assets/icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
    },
  };

  // Platform-specific title bar configuration
  if (process.platform === "darwin") {
    // macOS: hidden title bar with traffic light buttons
    windowOptions.titleBarStyle = "hidden";
    windowOptions.trafficLightPosition = { x: 20, y: 19 }; // y = (50-12)/2 ≈ 19 for vertical center
  } else if (process.platform === "win32") {
    // Windows: use titleBarOverlay for custom title bar
    windowOptions.titleBarStyle = "hidden";
    windowOptions.titleBarOverlay = {
      height: 50,
    };
  } else {
    // Linux: use default title bar
    windowOptions.frame = true;
  }

  // Create the browser window.
  mainWindow = new BrowserWindow(windowOptions);

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Handle window close event - hide instead of closing completely
  mainWindow.on("close", (event) => {
    // If app.quit() was called explicitly (from tray menu) or auto-update is in progress, don't prevent the window from closing
    if (isQuitting || isAutoUpdateInProgress) return;

    // Otherwise prevent the window from closing by default
    event.preventDefault();

    if (mainWindow) {
      // Just hide the window instead of closing it
      mainWindow.hide();

      // Hide the app from the Dock on macOS when window is closed
      if (process.platform === "darwin" && app.dock) {
        app.dock.hide();
      }
    }
  });

  // Handle actual window closed event if it occurs
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
};

const createBackgroundWindow = () => {
  // Create the background window for agent chat processing
  backgroundWindow = new BrowserWindow({
    width: app.isPackaged ? 1 : 800,
    height: app.isPackaged ? 1 : 600,
    show: !app.isPackaged, // Show during development for debugging
    frame: !app.isPackaged,
    skipTaskbar: app.isPackaged,
    title: "Background Chat Window",
    webPreferences: {
      preload: BACKGROUND_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
    },
  });

  // Load the background renderer
  backgroundWindow.loadURL(BACKGROUND_WINDOW_WEBPACK_ENTRY);

  backgroundWindow.on("closed", () => {
    backgroundWindow = null;
  });

  if (!app.isPackaged) {
    // Open dev tools for debugging background window
    backgroundWindow.webContents.openDevTools();
  }
};

/**
 * Sets up a timer to periodically update the tray context menu
 * @param mcpServerManager The MCPServerManager instance
 * @param intervalMs Time between updates in milliseconds
 */
function setupTrayUpdateTimer(
  mcpServerManager: MCPServerManager,
  intervalMs = 5000,
) {
  if (trayUpdateTimer) {
    clearInterval(trayUpdateTimer);
  }

  trayUpdateTimer = setInterval(() => {
    updateTrayContextMenu(mcpServerManager);
  }, intervalMs);
}

/**
 * データベースの初期化を行う
 */
async function initDatabase(): Promise<void> {
  try {
    // ワークスペースサービスは自動的にメタデータベースを初期化する
    const workspaceService = getWorkspaceService();

    // アクティブなワークスペースを取得
    const activeWorkspace = await workspaceService.getActiveWorkspace();
    if (!activeWorkspace) {
      // デフォルトワークスペースがない場合は作成
      await workspaceService.switchWorkspace("local-default");
    }

    // ワークスペース固有のデータベースのマイグレーションは
    // PlatformAPIManagerが初期化時に実行する
  } catch (error) {
    console.error(
      "データベースマイグレーション中にエラーが発生しました:",
      error,
    );
  }
}

/**
 * MCP関連サービスの初期化を行う
 */
async function initMCPServices(): Promise<void> {
  // Platform APIマネージャーの初期化（ワークスペースDBを設定）
  await getPlatformAPIManager().initialize();

  // MCPサーバーマネージャーの初期化
  mcpServerManager = new MCPServerManager();

  // データベースからサーバーリストを読み込む
  await mcpServerManager.initializeAsync();

  // HTTPサーバーの初期化とスタート
  mcpHttpServer = new MCPHttpServer(mcpServerManager, 3282);
  try {
    await mcpHttpServer.start();
  } catch (error) {
    console.error("Failed to start MCP HTTP Server:", error);
  }

  // 既存のMCPサーバー設定をインポート
  await importExistingServerConfigurations();
}

/**
 * ユーザーインターフェース関連の初期化を行う
 */
function initUI(): void {
  // メインウィンドウ作成
  createWindow();

  // Platform APIマネージャーにメインウィンドウを設定
  if (mainWindow) {
    getPlatformAPIManager().setMainWindow(mainWindow);
  }

  // バックグラウンドウィンドウ作成
  createBackgroundWindow();

  // システムトレイ作成
  createTray(mcpServerManager);

  // トレイコンテキストメニューの定期更新を設定
  setupTrayUpdateTimer(mcpServerManager);
}

// Set up autoUpdater event listeners
autoUpdater.on("update-downloaded", () => {
  isUpdateAvailable = true;
  // Notify renderer process about available update
  if (mainWindow) {
    mainWindow.webContents.send("update:downloaded", true);
  }
});

/**
 * Update functions
 */
function setupUpdateHandlers(): void {
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
    isQuitting = true;
    app.quit();
    return true;
  });

  // Handle system info request
  ipcMain.handle("system:getPlatform", () => {
    return process.platform;
  });
}

/**
 * アプリケーション全体の初期化を行う
 */
async function initApplication(): Promise<void> {
  const DEV_CSP = `
    default-src 'self' 'unsafe-inline' http://localhost:* ws://localhost:*;
    script-src 'self' 'unsafe-eval' 'unsafe-inline';
    connect-src 'self' http://localhost:* ws://localhost:* https://mcp-router.net;
    img-src 'self' data:;
  `
    .replace(/\s+/g, " ")
    .trim();

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [DEV_CSP],
      },
    });
  });

  // アプリケーション名を設定
  app.setName("MCP Router");

  // アプリケーションメニューを設定
  setApplicationMenu();

  // システム起動時の自動起動を設定
  if (!app.getLoginItemSettings().openAtLogin) {
    app.setLoginItemSettings({
      openAtLogin: true,
    });
  }

  // 暗号化機能の初期化を待機
  await setEncryptionInitialized(true);

  // データベース初期化
  await initDatabase();

  // IPC通信ハンドラの初期化
  setupIpcHandlers();

  // Update handlers
  setupUpdateHandlers();

  // MCPサービス初期化
  await initMCPServices();

  // UI初期化
  initUI();
}

app.on("ready", initApplication);

// Keep the app running when all windows are closed
// The app will continue to run in the background with only the tray icon visible
app.on("window-all-closed", () => {
  // Don't quit the app regardless of platform
  // The app will remain active with the tray icon
  if (process.platform === "darwin" && app.dock) {
    app.dock.hide(); // Hide from dock when all windows are closed
  }
  // console.log('All windows closed, app continues running in the background');
});

app.on("activate", () => {
  // Show the app in the Dock on macOS when activated
  if (process.platform === "darwin" && app.dock) {
    app.dock.show();
  }

  // Re-create a window if there are no windows open
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

// Register the app as default handler for mcpr:// protocol
app.whenReady().then(() => {
  app.setAsDefaultProtocolClient("mcpr");
});

// Handle the mcpr:// protocol on macOS
app.on("open-url", (event, url) => {
  event.preventDefault();

  // Store the URL to be processed after app is ready if needed
  const processUrl = () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else if (app.isReady()) {
      createWindow();
    } else {
      // If app is not ready yet, wait until it is before creating the window
      app.whenReady().then(() => {
        createWindow();
        // Process the URL after the window is created
        handleProtocolUrl(url);
      });
      return; // Return early to avoid processing URL twice
    }
    handleProtocolUrl(url);
  };

  processUrl();
});

// Clean up when quitting
app.on("will-quit", async () => {
  // Clear the tray update timer
  if (trayUpdateTimer) {
    clearInterval(trayUpdateTimer);
    trayUpdateTimer = null;
  }
  // Stop the HTTP server
  try {
    await mcpHttpServer.stop();
  } catch (error) {
    console.error("Failed to stop MCP HTTP Server:", error);
  }

  mcpServerManager.shutdown();
});

// Override the default app.quit to set our isQuitting flag first
const originalQuit = app.quit;
app.quit = function (...args) {
  // Set the flag to allow the window to close
  isQuitting = true;
  // Call the original quit method
  return originalQuit.apply(this, args);
};

// Process protocol URLs (mcpr://) - replaces the old protocol.registerHttpProtocol handler
export async function handleProtocolUrl(urlString: string) {
  try {
    const url = new URL(urlString);
    // Notify renderer process about the protocol URL
    if (mainWindow) {
      mainWindow.webContents.send("protocol:url", urlString);
    }
  } catch (error) {
    console.error("Failed to process protocol URL:", error);
  }
}

/**
 * IPC通信ハンドラのセットアップを行う関数
 * アプリケーション初期化時に呼び出される
 */
function setupIpcHandlers(): void {
  // 認証関連
  setupAuthHandlers();

  // MCPサーバー関連
  setupMcpServerHandlers();

  // ログ関連
  setupLogHandlers();

  // 設定関連
  setupSettingsHandlers();

  // MCPアプリ設定関連
  setupMcpAppsHandlers();

  // ユーティリティ関連
  setupUtilityHandlers();

  // トークン関連
  setupTokenHandlers();

  // フィードバック関連
  setupFeedbackHandlers();

  // パッケージバージョン解決関連
  registerPackageVersionHandlers();

  // パッケージマネージャー関連
  registerPackageManagerHandlers();

  // エージェント関連
  setupAgentHandlers();

  // ワークスペース関連
  registerWorkspaceHandlers();
}

/**
 * 認証関連のIPC通信ハンドラをセットアップ
 */
function setupAuthHandlers(): void {
  ipcMain.handle("auth:login", (_, idp?: string) => {
    startAuthFlow(idp);
    return true;
  });

  ipcMain.handle("auth:logout", () => {
    const result = logout();
    // Status change is now handled directly in the logout function
    return result;
  });

  ipcMain.handle("auth:status", async (_, forceRefresh?: boolean) => {
    const result = await status(forceRefresh);
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

/**
 * MCPサーバー関連のIPC通信ハンドラをセットアップ
 */
function setupMcpServerHandlers(): void {
  ipcMain.handle("mcp:list", () => {
    return mcpServerManager.getServers();
  });

  ipcMain.handle("mcp:start", async (_, id: string) => {
    try {
      const result = await mcpServerManager.startServer(id, "MCP Router UI");
      return result;
    } catch (error) {
      throw error;
    }
  });

  ipcMain.handle("mcp:stop", (_, id: string) => {
    const result = mcpServerManager.stopServer(id, "MCP Router UI");
    return result;
  });

  ipcMain.handle("mcp:add", async (_, serverConfig: MCPServerConfig) => {
    try {
      // Add the server to the manager
      const server = mcpServerManager.addServer(serverConfig);

      // For remote servers, automatically start the connection
      if (serverConfig.serverType !== "local") {
        // Start the server
        const success = await mcpServerManager.startServer(server.id);
        return {
          success,
          server,
          message: success
            ? "Remote server connected successfully"
            : "Failed to connect to remote server",
        };
      }

      // For local servers, just return the added server without starting
      return server;
    } catch (error: any) {
      console.error("Error adding server:", error);
      return {
        success: false,
        message: `Error adding server: ${error.message}`,
      };
    }
  });

  ipcMain.handle("mcp:remove", (_, id: string) => {
    const result = mcpServerManager.removeServer(id);
    return result;
  });

  ipcMain.handle(
    "mcp:update-config",
    (_, id: string, config: Partial<MCPServerConfig>) => {
      const result = mcpServerManager.updateServer(id, config);
      return result;
    },
  );

  ipcMain.handle(
    "mcp:fetch-from-index",
    async (
      _,
      page?: number,
      limit?: number,
      search?: string,
      isVerified?: boolean,
    ) => {
      return await fetchMcpServersFromIndex(page, limit, search, isVerified);
    },
  );

  ipcMain.handle(
    "mcp:fetch-server-version-details",
    async (_, displayId: string, version: string) => {
      return await fetchMcpServerVersionDetails(displayId, version);
    },
  );
}

/**
 * ログ関連のIPC通信ハンドラをセットアップ
 */
function setupLogHandlers(): void {
  ipcMain.handle(
    "requestLogs:get",
    async (
      _,
      options?: {
        clientId?: string;
        serverId?: string;
        requestType?: string;
        startDate?: Date;
        endDate?: Date;
        responseStatus?: "success" | "error";
        offset?: number;
        limit?: number;
      },
    ) => {
      try {
        const result = await logService.getRequestLogs(options || {});
        return result;
      } catch (error) {
        console.error("[RequestLogs] Error retrieving request logs:", error);
        return { logs: [], total: 0 };
      }
    },
  );
}

/**
 * 設定関連のIPC通信ハンドラをセットアップ
 */
function setupSettingsHandlers(): void {
  ipcMain.handle("settings:get", () => {
    try {
      const settingsService = getSettingsService();
      return settingsService.getSettings();
    } catch (error) {
      console.error("Failed to get settings:", error);
      return { authBypassEnabled: false };
    }
  });

  ipcMain.handle("settings:save", (_, settings: any) => {
    try {
      const settingsService = getSettingsService();
      return settingsService.saveSettings(settings);
    } catch (error) {
      console.error("Failed to save settings:", error);
      return false;
    }
  });

  ipcMain.handle("settings:increment-package-manager-overlay-count", () => {
    try {
      const settingsService = getSettingsService();
      const currentSettings = settingsService.getSettings();
      const newCount =
        (currentSettings.packageManagerOverlayDisplayCount || 0) + 1;
      const updatedSettings = {
        ...currentSettings,
        packageManagerOverlayDisplayCount: newCount,
      };
      const success = settingsService.saveSettings(updatedSettings);
      return { success, count: newCount };
    } catch (error) {
      console.error(
        "Failed to increment package manager overlay display count:",
        error,
      );
      return { success: false, count: 0 };
    }
  });
}

/**
 * MCPアプリ設定関連のIPC通信ハンドラをセットアップ
 */
function setupMcpAppsHandlers(): void {
  ipcMain.handle("mcp-apps:list", async () => {
    try {
      return await listMcpApps();
    } catch (error) {
      console.error("Failed to list MCP apps:", error);
      return [];
    }
  });

  ipcMain.handle("mcp-apps:delete", async (_, appName: string) => {
    try {
      return await deleteCustomApp(appName);
    } catch (error) {
      console.error(`Failed to delete custom app ${appName}:`, error);
      return false;
    }
  });

  ipcMain.handle("mcp-apps:add", async (_, appName: string) => {
    try {
      return await addApp(appName);
    } catch (error) {
      console.error(`Failed to add MCP config to ${appName}:`, error);
      return {
        success: false,
        message: `Error adding MCP configuration to ${appName}: ${error.message}`,
      };
    }
  });

  ipcMain.handle(
    "mcp-apps:update-server-access",
    async (_, appName: string, serverIds: string[]) => {
      try {
        return await updateAppServerAccess(appName, serverIds);
      } catch (error) {
        console.error(`Failed to update server access for ${appName}:`, error);
        return {
          success: false,
          message: `Error updating server access for ${appName}: ${error.message}`,
        };
      }
    },
  );

  ipcMain.handle("mcp-apps:unify", async (_, appName: string) => {
    try {
      return await unifyAppConfig(appName);
    } catch (error) {
      console.error(`Failed to unify config for ${appName}:`, error);
      return {
        success: false,
        message: `Error unifying configuration for ${appName}: ${error.message}`,
      };
    }
  });
}

/**
 * ユーティリティ関連のIPC通信ハンドラをセットアップ
 */
function setupUtilityHandlers(): void {
  // Check if a command exists in user shell environment
  ipcMain.handle("command:exists", async (_, command: string) => {
    const result = await commandExists(command);
    return result;
  });
}

/**
 * トークン関連のIPC通信ハンドラをセットアップ
 */
function setupTokenHandlers(): void {
  ipcMain.handle(
    "token:updateScopes",
    (_, tokenId: string, scopes: TokenScope[]) => {
      try {
        const tokenService = getTokenService();
        const success = tokenService.updateTokenScopes(tokenId, scopes);

        if (success) {
          // Get the updated token
          const tokens = tokenService.listTokens();
          const token = tokens.find((t) => t.id === tokenId);

          // Get the app name from the token client ID (assuming client ID = app name)
          const appName = token?.clientId;

          // Build a basic McpApp object to return
          if (token && appName) {
            return {
              success: true,
              message: "Token scopes updated successfully",
              app: {
                name: appName,
                installed: true,
                configured: true,
                configPath: "", // Required field but we don't have it here
                token: token.id,
                serverIds: token.serverIds,
                scopes: token.scopes,
              },
            };
          }
        }

        return {
          success: false,
          message: "Failed to update token scopes",
        };
      } catch (error: any) {
        console.error("Failed to update token scopes:", error);
        return {
          success: false,
          message: `Error updating token scopes: ${error.message}`,
        };
      }
    },
  );
}

/**
 * フィードバック関連のIPC通信ハンドラをセットアップ
 */
function setupFeedbackHandlers(): void {
  ipcMain.handle("feedback:submit", async (_, feedback: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ feedback }),
      });
      return response.ok;
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      return false;
    }
  });
}
