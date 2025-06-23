/**
 * Platform API re-export
 * 
 * This module re-exports the Electron platform API for backward compatibility
 */

import { electronPlatformAPI } from "./electron-platform-api";

// Export the Electron platform API as the default platform API
export const platformAPI = electronPlatformAPI;

// Re-export types and utilities from frontend package
export { PlatformAPI, isElectron, isWeb } from "@mcp-router/frontend";

// Export convenience hook
export const usePlatformAPI = () => platformAPI;