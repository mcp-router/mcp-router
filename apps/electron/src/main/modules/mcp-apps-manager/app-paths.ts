import fs from "fs";
import path from "path";
import os from "os";

/**
 * アプリケーションパス管理クラス
 */
export class AppPaths {
  private HOME = os.homedir();

  private vscodeGlobalStorageDir(): string {
    switch (process.platform) {
      case "win32":
        return path.join(
          this.HOME,
          "AppData",
          "Roaming",
          "Code",
          "User",
          "globalStorage",
        );
      case "darwin":
        return path.join(
          this.HOME,
          "Library",
          "Application Support",
          "Code",
          "User",
          "globalStorage",
        );
      default: // linux, freebsd, etc.
        return path.join(this.HOME, ".config", "Code", "User", "globalStorage");
    }
  }

  public claudeConfig(): string {
    switch (process.platform) {
      case "win32":
        return path.join(
          this.HOME,
          "AppData",
          "Roaming",
          "Claude",
          "claude_desktop_config.json",
        );
      case "darwin":
        return path.join(
          this.HOME,
          "Library",
          "Application Support",
          "Claude",
          "claude_desktop_config.json",
        );
      default:
        return path.join(
          this.HOME,
          ".config",
          "Claude",
          "claude_desktop_config.json",
        );
    }
  }

  public cursorConfig(projectDir = ""): string {
    // プロジェクト固有ファイルが優先
    if (projectDir != "") {
      const projectPath = path.join(projectDir, ".cursor", "mcp.json");
      if (fs.existsSync(projectPath)) return projectPath;
    }
    // グローバル設定
    return path.join(this.HOME, ".cursor", "mcp.json");
  }

  public windsurfConfig(): string {
    // Windows 版も .codeium は HOME 直下 (store 版を除く)
    return path.join(this.HOME, ".codeium", "windsurf", "mcp_config.json");
  }

  public clineConfig(): string {
    return path.join(
      this.vscodeGlobalStorageDir(),
      "saoudrizwan.claude-dev",
      "settings",
      "cline_mcp_settings.json",
    );
  }

  public vscodeConfig(): string {
    switch (process.platform) {
      case "win32":
        return path.join(
          this.HOME,
          "AppData",
          "Roaming",
          "Code",
          "User",
          "mcp.json",
        );
      case "darwin":
        return path.join(
          this.HOME,
          "Library",
          "Application Support",
          "Code",
          "User",
          "mcp.json",
        );
      default:
        return path.join(this.HOME, ".config", "Code", "User", "mcp.json");
    }
  }

  public async exists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}
