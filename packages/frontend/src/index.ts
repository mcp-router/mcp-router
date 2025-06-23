// Export everything from @mcp-router/ui
// This includes all UI components, hooks (useIsMobile), and utilities (cn)
export * from "@mcp-router/ui";

// Export enhanced error display component
export { EnhancedErrorDisplay } from "./components/enhanced-error-display";

// Export all stores
export * from "./stores";

// Re-export platform API from dedicated package
export {
  // Interface
  PlatformAPI,
  // Factory and utilities
  isElectron,
  isWeb,
  WebPlatformAPI,
  createPlatformAPI,
  // Context and provider
  PlatformAPIProvider,
  usePlatformAPI,
  usePlatformAPIAvailable,
} from "@mcp-router/platform-api";
