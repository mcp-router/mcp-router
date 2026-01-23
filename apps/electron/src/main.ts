import { app, BrowserWindow, session, shell, nativeTheme } from "electron";
import path from "node:path";
import { MCPServerManager } from "@/main/modules/mcp-server-manager/mcp-server-manager";
import { AggregatorServer } from "@/main/modules/mcp-server-runtime/aggregator-server";
import { MCPHttpServer } from "@/main/modules/mcp-server-runtime/http/mcp-http-server";
import { ToolCatalogService } from "@/main/modules/tool-catalog/tool-catalog.service";
import started from "electron-squirrel-startup";
import { updateElectronApp } from "update-electron-app";
import { setApplicationMenu } from "@/main/ui/menu";
import { createTray, updateTrayContextMenu } from "@/main/ui/tray";
import { importExistingServerConfigurations } from "@/main/modules/mcp-apps-manager/mcp-config-importer";
import { getPlatformAPIManager } from "@/main/modules/workspace/platform-api-manager";
import { getWorkspaceService } from "@/main/modules/workspace/workspace.service";
import { getSharedConfigManager } from "@/main/infrastructure/shared-config-manager";
import { setupIpcHandlers } from "./main/infrastructure/ipc";
import { resolveAutoUpdateConfig } from "./main/modules/system/app-updator";
import { getIsAutoUpdateInProgress } from "./main/modules/system/system-handler";
import { initializeEnvironment, isDevelopment } from "@/main/utils/environment";
import { getCloudSyncService } from "@/main/modules/cloud-sync/cloud-sync.service";
import {
  applyLoginItemSettings,
  applyThemeSettings,
  getSettingsService,
} from "@/main/modules/settings/settings.service";
import { getSkillService } from "@/main/modules/skills/skills.service";

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
// Flag to track if app.quit() was explicitly called
let isQuitting = false;
// Timer for updating tray context menu
let trayUpdateTimer: NodeJS.Timeout | null = null;

export const BASE_URL = "https://mcp-router.net/";
export const API_BASE_URL = `${BASE_URL}api`;

// Configure auto update (guarded to avoid crash on unsigned macOS builds)
const { enabled: enableAutoUpdate, options: autoUpdateOptions } =
  resolveAutoUpdateConfig();

if (enableAutoUpdate && autoUpdateOptions) {
  updateElectronApp(autoUpdateOptions);
}

// Declare global variables defined by Electron Forge
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string | undefined;
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;

// グローバル変数の宣言（初期化は後で行う）
let serverManager: MCPServerManager;
let aggregatorServer: AggregatorServer;
let mcpHttpServer: MCPHttpServer;
let toolCatalogService: ToolCatalogService;

type CreateWindowOptions = {
  showOnCreate?: boolean;
};

const createWindow = ({ showOnCreate = true }: CreateWindowOptions = {}) => {
  // Platform-specific window options
  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "MCP Router",
    icon: path.join(__dirname, "assets/icon.png"),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
      devTools: isDevelopment(),
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

  // Apply Windows title bar overlay colors based on system theme
  if (process.platform === "win32") {
    const applyTitleBarColors = () => {
      if (!mainWindow) return;
      const isDark = nativeTheme.shouldUseDarkColors;
      const isHighContrast = nativeTheme.shouldUseHighContrastColors;
      const overlayColor = isHighContrast
        ? "#00000000" // transparent in high contrast, let OS handle
        : isDark
          ? "#0a0a0a"
          : "#ffffff";
      const symbolColor = isHighContrast
        ? undefined
        : isDark
          ? "#ffffff"
          : "#000000";
      mainWindow.setTitleBarOverlay({
        color: overlayColor,
        symbolColor,
        height: 50,
      });
    };

    applyTitleBarColors();
    nativeTheme.on("updated", applyTitleBarColors);
    mainWindow.on("closed", () => {
      nativeTheme.removeListener("updated", applyTitleBarColors);
    });
  }

  mainWindow.once("ready-to-show", () => {
    if (!mainWindow) {
      return;
    }

    if (showOnCreate) {
      mainWindow.show();
    } else {
      mainWindow.hide();
    }
  });

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

  if (isDevelopment()) {
    mainWindow.webContents.openDevTools();
  }
};

/**
 * Sets up a timer to periodically update the tray context menu
 * @param serverManager The MCPServerManager instance
 * @param intervalMs Time between updates in milliseconds
 */
function setupTrayUpdateTimer(
  serverManager: MCPServerManager,
  intervalMs = 5000,
) {
  if (trayUpdateTimer) {
    clearInterval(trayUpdateTimer);
  }

  trayUpdateTimer = setInterval(() => {
    updateTrayContextMenu(serverManager);
  }, intervalMs);
}

/**
 * データベースの初期化を行う
 */
async function initDatabase(): Promise<void> {
  try {
    // 共通設定マネージャーを初期化（既存データからのマイグレーションを含む）
    await getSharedConfigManager().initialize();

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
  // MCPServerManager プロバイダを先に設定（serverManager は後で代入される）
  getPlatformAPIManager().setServerManagerProvider(() => serverManager);
  await getPlatformAPIManager().initialize();

  // MCPServerManagerの初期化
  serverManager = new MCPServerManager();

  // データベースからサーバーリストを読み込む
  await serverManager.initializeAsync();

  // Cloud SyncサービスにServerManagerを連携
  getCloudSyncService().initialize(() => serverManager);

  // Tool catalog service
  toolCatalogService = new ToolCatalogService(serverManager);

  // AggregatorServerの初期化
  aggregatorServer = new AggregatorServer(serverManager, toolCatalogService);

  // HTTPサーバーの初期化とスタート
  mcpHttpServer = new MCPHttpServer(serverManager, 3282, aggregatorServer);
  try {
    await mcpHttpServer.start();
  } catch (error) {
    console.error("Failed to start MCP HTTP Server:", error);
  }

  // 既存のMCPサーバー設定をインポート
  await importExistingServerConfigurations();

  // スキルのシンボリックリンクを検証・修復
  getSkillService().verifyAndRepairSymlinks();
}

/**
 * ユーザーインターフェース関連の初期化を行う
 */
function initUI({
  showMainWindow = true,
}: { showMainWindow?: boolean } = {}): void {
  // メインウィンドウ作成
  createWindow({ showOnCreate: showMainWindow });

  if (!showMainWindow && process.platform === "darwin" && app.dock) {
    app.dock.hide();
  }

  // Platform APIマネージャーにメインウィンドウを設定
  if (mainWindow) {
    getPlatformAPIManager().setMainWindow(mainWindow);
  }

  // システムトレイ作成
  createTray(serverManager);

  // トレイコンテキストメニューの定期更新を設定
  setupTrayUpdateTimer(serverManager);
}

/**
 * アプリケーション全体の初期化を行う
 */
async function initApplication(): Promise<void> {
  // 環境設定を初期化
  initializeEnvironment();
  const DEV_CSP = `
    default-src 'self' 'unsafe-inline' http://localhost:* ws://localhost:*;
    script-src 'self' 'unsafe-eval' 'unsafe-inline';
    connect-src 'self' http://localhost:* ws://localhost:* https://mcp-router.net https://staging.mcp-router.net https://us.i.posthog.com https://us-assets.i.posthog.com;
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

  // 起動時のウィンドウ表示設定を取得
  const settingsService = getSettingsService();
  let showWindowOnStartup = true;
  try {
    const currentSettings = settingsService.getSettings();
    showWindowOnStartup = currentSettings.showWindowOnStartup ?? true;
    applyThemeSettings(currentSettings.theme);
  } catch (error) {
    console.error(
      "Failed to load startup visibility preference, defaulting to true:",
      error,
    );
  }

  const loginItemState = app.getLoginItemSettings();
  const launchedAtLogin = loginItemState.wasOpenedAtLogin ?? false;
  const launchedWithHiddenFlag = process.argv.some((arg) =>
    ["--hidden", "--minimized"].includes(arg),
  );

  applyLoginItemSettings(showWindowOnStartup);

  // データベース初期化
  await initDatabase();

  // MCPサービス初期化
  await initMCPServices();

  // IPC通信ハンドラの初期化
  setupIpcHandlers({
    getServerManager: () => serverManager,
  });

  const shouldShowMainWindow =
    (!launchedAtLogin || showWindowOnStartup) && !launchedWithHiddenFlag;

  // UI初期化
  initUI({ showMainWindow: shouldShowMainWindow });
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

  serverManager.shutdown();
  aggregatorServer.shutdown();
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
