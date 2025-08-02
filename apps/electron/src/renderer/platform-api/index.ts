/**
 * Platform API exports for Electron
 *
 * This module provides platform API utilities
 * specifically for the Electron application
 */

// Platform API React context and provider (for backward compatibility)
export { PlatformAPIProvider } from "./platform-api-context";

// Export the store-based hook instead of the context-based one
export { usePlatformAPI } from "@/renderer/platform-api/hooks/use-platform-api";
