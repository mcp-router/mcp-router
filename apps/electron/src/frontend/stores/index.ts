// Platform-independent stores (no PlatformAPI dependency)
export * from "./theme-store";
export * from "./ui-store";
export * from "./server-editing-store";
export * from "./workspace-store";

// Platform-dependent store factories
export * from "./server-store";
export * from "./auth-store";
export * from "./agent-store";

// Import the electron platform API
import { electronPlatformAPI } from "../lib/electron-platform-api";

// Import store factories
import { createServerStore, createServerSelectors } from "./server-store";
import { createAuthStore, createAuthSelectors } from "./auth-store";
import { createAgentStore, createAgentSelectors } from "./agent-store";

// Create store instances with Electron platform API
export const useServerStore = createServerStore(electronPlatformAPI);
export const useAuthStore = createAuthStore(electronPlatformAPI);
export const useAgentStore = createAgentStore(electronPlatformAPI);

// Create selectors from store instances
const serverSelectors = createServerSelectors(useServerStore);
const authSelectors = createAuthSelectors(useAuthStore);
const agentSelectors = createAgentSelectors(useAgentStore);

// Export server selectors
export const useServerById = serverSelectors.useServerById;
export const useServersByStatus = serverSelectors.useServersByStatus;
export const useIsServerUpdating = serverSelectors.useIsServerUpdating;

// Export auth selectors
export const useIsLoggedIn = authSelectors.useIsLoggedIn;
export const useAuthToken = authSelectors.useAuthToken;
export const useUserId = authSelectors.useUserId;

// Export agent selectors
export const useCurrentAgent = agentSelectors.useCurrentAgent;
export const useCurrentSession = agentSelectors.useCurrentSession;
export const useSessionsByAgent = agentSelectors.useSessionsByAgent;

// Store initialization utility
export const initializeStores = async () => {
  // Initialize auth state from settings
  try {
    const settings = await electronPlatformAPI.getSettings();
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

  // Load initial agent data
  try {
    await useAgentStore.getState().refreshAgents();
  } catch (error) {
    console.error("Failed to load initial agents:", error);
  }
};
