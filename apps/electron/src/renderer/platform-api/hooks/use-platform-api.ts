/**
 * Custom hook to get the platform API based on the current workspace
 * This replaces the context-based approach with a direct store-based approach
 */

import { useWorkspaceStore } from "@/renderer/stores/workspace-store";
import { useAuthStore } from "@/renderer/stores";
import { useMemo } from "react";
import type { PlatformAPI } from "@mcp_router/shared";

export function usePlatformAPI(): PlatformAPI {
  const getPlatformAPI = useWorkspaceStore((state) => state.getPlatformAPI);
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspace?.id);
  const workspaceType = useWorkspaceStore(
    (state) => state.currentWorkspace?.type,
  );
  const authToken = useAuthStore((state) => state.authToken);

  return useMemo(
    () => getPlatformAPI(),
    [getPlatformAPI, workspaceId, workspaceType, authToken],
  );
}
