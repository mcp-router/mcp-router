/**
 * Platform API interface that abstracts the underlying platform implementation
 * This allows the frontend stores to work with both Electron and Web platforms
 */

// Export the domain-based API
export { PlatformAPI } from "./types/platform-api";
export * from "./types/domains/auth-api";
export * from "./types/domains/server-api";
export * from "./types/domains/agent-api";
export * from "./types/domains/app-api";
export * from "./types/domains/package-api";
export * from "./types/domains/settings-api";
export * from "./types/domains/log-api";
export * from "./types/domains/workspace-api";
