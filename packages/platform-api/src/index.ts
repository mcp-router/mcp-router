// Platform API interfaces
export { PlatformAPI, LegacyPlatformAPI } from "./platform-api-interface";
export * from "./types/domains/auth-api";
export * from "./types/domains/server-api";
export * from "./types/domains/agent-api";
export * from "./types/domains/app-api";
export * from "./types/domains/package-api";
export * from "./types/domains/settings-api";
export * from "./types/domains/log-api";
export * from "./types/domains/workspace-api";

// Platform API adapters
export { LegacyPlatformAPIAdapter } from "./adapters";

// Platform API factory and utilities
export {
  isElectron,
  isWeb,
  WebPlatformAPI,
  createPlatformAPI,
} from "./platform-api-factory";

// Platform API React context and provider
export {
  PlatformAPIProvider,
  usePlatformAPI,
  usePlatformAPIAvailable,
} from "./platform-api-context";
