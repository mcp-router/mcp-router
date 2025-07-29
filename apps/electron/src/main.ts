import { app, BrowserWindow, session, shell } from "electron";
import path from "node:path";
import { MCPServerManager } from "@/main/application/mcp-core/mcp-manager";
import { MCPHttpServer } from "@/main/application/mcp-core/mcp-manager/http/mcp-http-server";
import started from "electron-squirrel-startup";
import { updateElectronApp } from "update-electron-app";
import { setApplicationMenu } from "@/main/application/ui/menu";
import { createTray, updateTrayContextMenu } from "@/main/application/ui/tray";
import { importExistingServerConfigurations } from "@/main/application/mcp-core/apps/mcp-config-importer";
import { getPlatformAPIManager } from "@/main/application/workspace/platform-api-manager";
import { getWorkspaceService } from "./main/domain/workspace/workspace-service";
import { setupIpcHandlers } from "./main/infrastructure/ipc";
import { getIsAutoUpdateInProgress } from "./main/infrastructure/ipc/handlers/update-handler";

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  // If we can't get the lock, it means another instance is running
  // Exit this instance, but the first instance will be notified via second-instance event
  app.exit();
}

// Listen for second instance launches and focus the existing window
app.on("second-instance", (_event, commandLine) => {
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

// Squirrelの初回起動時の処理
if (started) app.quit();

// Global references
export let mainWindow: BrowserWindow | null = null;
export let backgroundWindow: BrowserWindow | null = null;
// Flag to track if app.quit() was explicitly called
let isQuitting = false;
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
    if (isQuitting || getIsAutoUpdateInProgress()) return;

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

  // データベース初期化
  await initDatabase();

  // IPC通信ハンドラの初期化
  setupIpcHandlers();

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
    if (mainWindow && mainWindow.isMinimized()) mainWindow.restore();
    if (mainWindow) mainWindow.show();
    if (mainWindow) mainWindow.focus();
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
    if (mainWindow) {
      mainWindow.webContents.send("protocol:url", urlString);
    }
  } catch (error) {
    console.error("Failed to process protocol URL:", error);
  }
}
