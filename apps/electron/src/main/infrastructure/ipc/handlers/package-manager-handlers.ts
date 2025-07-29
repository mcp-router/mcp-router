import { ipcMain } from "electron";
import {
  checkPnpmExists,
  checkUvExists,
  installPNPM,
  installUV,
} from "@/main/domain/mcp-core/package/install-package-manager";

/**
 * Register package manager-related IPC handlers
 */
export function setupPackageManagerHandlers(): void {
  // Check both package managers and Node.js
  ipcMain.handle("packageManager:checkAll", async () => {
    try {
      const [pnpmAndNode, uv] = await Promise.all([
        checkPnpmExists(), // This now checks both pnpm and node
        checkUvExists(),
      ]);
      // If pnpm exists, node must also exist based on our checkPnpmExists logic
      return { node: pnpmAndNode, pnpm: pnpmAndNode, uv };
    } catch (error) {
      console.error("Error checking package managers:", error);
      return { node: false, pnpm: false, uv: false };
    }
  });

  // Install package managers (only installs missing ones)
  ipcMain.handle("packageManager:installAll", async () => {
    const result = {
      success: true,
      installed: { node: false, pnpm: false, uv: false },
      errors: {} as { node?: string; pnpm?: string; uv?: string },
      needsRestart: false,
    };

    try {
      // Check which package managers are already installed
      const [pnpmAndNodeExists, uvExists] = await Promise.all([
        checkPnpmExists(), // This checks both pnpm and node
        checkUvExists(),
      ]);

      // Install pnpm if not exists (this will also install Node.js if needed)
      if (!pnpmAndNodeExists) {
        try {
          await installPNPM();
          // Since checkPnpmExists returns false if either pnpm or node is missing,
          // we consider both were potentially installed
          result.installed.pnpm = true;
          result.installed.node = true;
        } catch (error) {
          console.error("Error installing pnpm/node:", error);
          result.success = false;
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          result.errors.pnpm = errorMessage;
          result.errors.node = errorMessage;
        }
      }

      // Install uv if not exists
      if (!uvExists) {
        try {
          await installUV();
          result.installed.uv = true;
        } catch (error) {
          console.error("Error installing uv:", error);
          result.success = false;
          result.errors.uv =
            error instanceof Error ? error.message : String(error);
        }
      }

      // If any package manager or Node.js was installed, set needsRestart flag
      if (
        result.installed.node ||
        result.installed.pnpm ||
        result.installed.uv
      ) {
        result.needsRestart = true;
      }

      return result;
    } catch (error) {
      console.error("Error in installPackageManagers:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        installed: { node: false, pnpm: false, uv: false },
        errors: { node: errorMessage, pnpm: errorMessage, uv: errorMessage },
        needsRestart: false,
      };
    }
  });
}
