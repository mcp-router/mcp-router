import fs from "fs";
import path from "path";
import os from "os";

/* ── 共通：ホーム・VSCode globalStorage フォルダー ─────────────────────────── */

const HOME = os.homedir();

function vscodeGlobalStorageDir() {
  switch (process.platform) {
    case "win32":
      return path.join(
        HOME,
        "AppData",
        "Roaming",
        "Code",
        "User",
        "globalStorage",
      );
    case "darwin":
      return path.join(
        HOME,
        "Library",
        "Application Support",
        "Code",
        "User",
        "globalStorage",
      );
    default: // linux, freebsd, etc.
      return path.join(HOME, ".config", "Code", "User", "globalStorage");
  }
}

/* ── 各クライアントの MCP 設定ファイル ───────────────────────────────────── */

function claudeConfig() {
  switch (process.platform) {
    case "win32":
      return path.join(
        HOME,
        "AppData",
        "Roaming",
        "Claude",
        "claude_desktop_config.json",
      );
    case "darwin":
      return path.join(
        HOME,
        "Library",
        "Application Support",
        "Claude",
        "claude_desktop_config.json",
      );
    default:
      return path.join(HOME, ".config", "Claude", "claude_desktop_config.json");
  }
}

function cursorConfig(projectDir = "") {
  // プロジェクト固有ファイルが優先
  if (projectDir != "") {
    const projectPath = path.join(projectDir, ".cursor", "mcp.json");
    if (fs.existsSync(projectPath)) return projectPath;
  }
  // グローバル設定
  return path.join(HOME, ".cursor", "mcp.json");
}

function windsurfConfig() {
  // Windows 版も .codeium は HOME 直下 (store 版を除く)
  return path.join(HOME, ".codeium", "windsurf", "mcp_config.json");
}

function clineConfig() {
  return path.join(
    vscodeGlobalStorageDir(),
    "saoudrizwan.claude-dev",
    "settings",
    "cline_mcp_settings.json",
  );
}

function vscodeConfig() {
  switch (process.platform) {
    case "win32":
      return path.join(
        HOME,
        "AppData",
        "Roaming",
        "Code",
        "User",
        "settings.json",
      );
    case "darwin":
      return path.join(
        HOME,
        "Library",
        "Application Support",
        "Code",
        "User",
        "settings.json",
      );
    default:
      return path.join(HOME, ".config", "Code", "User", "settings.json");
  }
}

/* ── 補助：存在チェック付きで返すユーティリティ (optional) ───────────────── */

async function exists(filePath: string) {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export {
  vscodeGlobalStorageDir,
  claudeConfig,
  cursorConfig,
  windsurfConfig,
  clineConfig,
  vscodeConfig,
  exists,
};
