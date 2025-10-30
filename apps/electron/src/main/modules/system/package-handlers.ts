/**
 * package-handlers.ts
 *
 * Unified package management and version resolution handlers
 * Combines package manager installation/checking with version resolution functionality
 */

import { ipcMain } from "electron";
import {
  resolvePackageVersionsInArgs,
  checkMcpServerPackageUpdates,
} from "@/main/modules/system/package/package-version-resolver";
import {
  checkPnpmExists,
  checkUvExists,
  installPNPM,
  installUV,
} from "@/main/modules/system/package/install-package-manager";

/**
 * Register unified package-related IPC handlers
 */
export function setupPackageHandlers(): void {
  // ====================
  // Package Version Resolution
  // ====================

  // Handler for resolving package versions in arguments
  ipcMain.handle(
    "package:resolve-versions",
    async (_, argsString: string, packageManager: "pnpm" | "uvx") => {
      try {
        // Call the utility function directly
        const result = await resolvePackageVersionsInArgs(
          argsString,
          packageManager,
        );
        return { success: true, resolvedArgs: result };
      } catch (error) {
        console.error("Error resolving package versions:", error);
        return { success: false, error: (error as Error).message };
      }
    },
  );

  // Handler to check for updates to packages in a server
  ipcMain.handle(
    "package:check-updates",
    async (_, args: string[], packageManager: "pnpm" | "uvx") => {
      try {
        const updates = await checkMcpServerPackageUpdates(
          args,
          packageManager,
        );
        return { success: true, updates };
      } catch (error) {
        console.error("Failed to check for package updates:", error);
        return { success: false, error: String(error) };
      }
    },
  );

  // ====================
  // Package Manager Management
  // ====================

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
