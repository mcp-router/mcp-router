/**
 * Platform API exports for Electron
 *
 * This module provides all the platform API types and utilities
 * specifically for the Electron application
 */

// Platform API types
export { PlatformAPI } from "./types/platform-api";
export * from "./types/domains/auth-api";
export * from "./types/domains/server-api";
export * from "./types/domains/agent-api";
export * from "./types/domains/app-api";
export * from "./types/domains/package-api";
export * from "./types/domains/settings-api";
export * from "./types/domains/log-api";
export * from "./types/domains/workspace-api";

// Platform API React context and provider
export {
  PlatformAPIProvider,
  usePlatformAPI,
  type PlatformAPIProviderProps,
} from "./platform-api-context";
