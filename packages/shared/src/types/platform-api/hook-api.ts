import { MCPHook } from "../mcp-hook-types";

/**
 * Hook management API
 */
export interface HookAPI {
  /**
   * List all hooks
   */
  listHooks(): Promise<MCPHook[]>;

  /**
   * Get a specific hook by ID
   */
  getHook(id: string): Promise<MCPHook | null>;

  /**
   * Create a new hook
   */
  createHook(
    hookData: Omit<MCPHook, "id" | "createdAt" | "updatedAt">,
  ): Promise<MCPHook>;

  /**
   * Update an existing hook
   */
  updateHook(
    id: string,
    updates: Partial<Omit<MCPHook, "id" | "createdAt" | "updatedAt">>,
  ): Promise<MCPHook>;

  /**
   * Delete a hook
   */
  deleteHook(id: string): Promise<boolean>;

  /**
   * Enable or disable a hook
   */
  setHookEnabled(id: string, enabled: boolean): Promise<MCPHook>;

  /**
   * Reorder hooks
   */
  reorderHooks(hookIds: string[]): Promise<MCPHook[]>;
}
