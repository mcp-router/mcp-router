/**
 * package-version-handler.ts
 * 
 * Electron main process handler for package version resolution
 * Uses the package-version-resolver utility and exposes it through IPC
 */

import { ipcMain } from 'electron';
import { 
  resolvePackageVersionsInArgs,
  checkMcpServerPackageUpdates
} from '../../lib/utils/package-version-resolver';

/**
 * Register the IPC handlers for package version resolution
 */
export function registerPackageVersionHandlers(): void {
  // Handler for resolving package versions in arguments
  ipcMain.handle('package:resolve-versions', async (_, argsString: string, packageManager: 'pnpm' | 'uvx') => {
    try {
      // Call the utility function directly
      const result = await resolvePackageVersionsInArgs(argsString, packageManager);
      return { success: true, resolvedArgs: result };
    } catch (error) {
      console.error('Error resolving package versions:', error);
      return { success: false, error: (error as Error).message };
    }
  });
  
  // Handler to check for updates to packages in a server
  ipcMain.handle('package:check-updates', async (_, args: string[], packageManager: 'pnpm' | 'uvx') => {
    try {
      const updates = await checkMcpServerPackageUpdates(args, packageManager);
      return { success: true, updates };
    } catch (error) {
      console.error('Failed to check for package updates:', error);
      return { success: false, error: String(error) };
    }
  });
}
