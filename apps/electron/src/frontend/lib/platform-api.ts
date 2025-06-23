/**
 * Platform API re-export
 * 
 * This module provides backward compatibility for components importing from this path
 * while using the centralized platform API from packages
 */

// Re-export everything from the platform-api package
export { 
  PlatformAPI, 
  isElectron, 
  isWeb,
  platformAPI,
  usePlatformAPI,
  getPlatformAPI
} from "@mcp-router/platform-api";