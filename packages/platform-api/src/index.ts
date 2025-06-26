// Platform API interface
export { PlatformAPI } from "./platform-api-interface";

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
