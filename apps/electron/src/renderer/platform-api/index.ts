/**
 * Platform API exports for Electron
 *
 * This module provides platform API utilities
 * specifically for the Electron application
 */

// Export the store-based hook instead of the context-based one
export { usePlatformAPI } from "@/renderer/platform-api/hooks/use-platform-api";
