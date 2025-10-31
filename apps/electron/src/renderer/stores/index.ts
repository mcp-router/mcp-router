// Platform-independent stores (no PlatformAPI dependency)
export * from "./theme-store";
export * from "./ui-store";
export * from "./server-editing-store";
export * from "./workspace-store";
export * from "./view-preferences-store";

// Platform-dependent store factories
export * from "./server-store";
export * from "./auth-store";

// Import platform API type
import type { PlatformAPI } from "@mcp_router/shared";

// Import store factories
import { createServerStore } from "./server-store";
import { createAuthStore } from "./auth-store";
import { useWorkspaceStore } from "./workspace-store";

// Get the appropriate platform API based on current workspace
function getPlatformAPI(): PlatformAPI {
  return useWorkspaceStore.getState().getPlatformAPI();
}

// Create store instances with dynamic platform API getter
export const useServerStore = createServerStore(getPlatformAPI);
export const useAuthStore = createAuthStore(getPlatformAPI);

// Store initialization utility
export const initializeStores = async () => {
  // Load current workspace first
  await useWorkspaceStore.getState().loadCurrentWorkspace();

  // Get platform API from workspace store
  const platformAPI = getPlatformAPI();

  // Initialize auth state from settings
  try {
    const settings = await platformAPI.settings.get();
    await useAuthStore.getState().initializeFromSettings(settings);
  } catch (error) {
    console.error("Failed to initialize auth from settings:", error);
  }

  // Check current auth status
  try {
    await useAuthStore.getState().checkAuthStatus();
  } catch (error) {
    console.error("Failed to check auth status:", error);
  }

  // Load initial server data
  try {
    await useServerStore.getState().refreshServers();
  } catch (error) {
    console.error("Failed to load initial servers:", error);
  }
};
