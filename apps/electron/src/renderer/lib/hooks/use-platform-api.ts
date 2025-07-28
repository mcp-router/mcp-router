/**
 * Custom hook to get the platform API based on the current workspace
 * This replaces the context-based approach with a direct store-based approach
 */

import { useWorkspaceStore } from "@/renderer/stores/workspace-store";
import type { PlatformAPI } from "@/main/infrastructure/platform-api/types/platform-api";

export function usePlatformAPI(): PlatformAPI {
  // Get the platform API directly from the workspace store
  // This ensures it's always in sync with the current workspace
  return useWorkspaceStore((state) => state.getPlatformAPI)();
}
