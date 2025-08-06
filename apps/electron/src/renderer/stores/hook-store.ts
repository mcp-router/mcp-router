import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { MCPHook, PlatformAPI } from "@mcp_router/shared";

export interface HookStoreState {
  hooks: MCPHook[];
  loading: boolean;
  error: string | null;
  selectedHook: MCPHook | null;
}

export interface HookStoreActions {
  // Data fetching
  fetchHooks: () => Promise<void>;

  // CRUD operations
  createHook: (
    hookData: Omit<MCPHook, "id" | "createdAt" | "updatedAt">,
  ) => Promise<MCPHook>;
  updateHook: (
    id: string,
    updates: Partial<Omit<MCPHook, "id" | "createdAt" | "updatedAt">>,
  ) => Promise<void>;
  deleteHook: (id: string) => Promise<void>;

  // Hook management
  setHookEnabled: (id: string, enabled: boolean) => Promise<void>;
  reorderHooks: (hookIds: string[]) => Promise<void>;

  // UI state
  setSelectedHook: (hook: MCPHook | null) => void;
  clearError: () => void;
}

export type HookStore = HookStoreState & HookStoreActions;

export const createHookStore = (getPlatformAPI: () => PlatformAPI) =>
  create<HookStore>()(
    immer((set, get) => ({
      // Initial state
      hooks: [],
      loading: false,
      error: null,
      selectedHook: null,

      // Fetch all hooks
      fetchHooks: async () => {
        set((state) => {
          state.loading = true;
          state.error = null;
        });

        try {
          const platformAPI = getPlatformAPI();
          const hooks = await platformAPI.hooks.listHooks();

          set((state) => {
            state.hooks = hooks;
            state.loading = false;
          });
        } catch (error) {
          set((state) => {
            state.error =
              error instanceof Error ? error.message : "Failed to fetch hooks";
            state.loading = false;
          });
        }
      },

      // Create a new hook
      createHook: async (hookData) => {
        try {
          const platformAPI = getPlatformAPI();
          const newHook = await platformAPI.hooks.createHook(hookData);

          set((state) => {
            state.hooks.push(newHook);
          });

          return newHook;
        } catch (error) {
          set((state) => {
            state.error =
              error instanceof Error ? error.message : "Failed to create hook";
          });
          throw error;
        }
      },

      // Update an existing hook
      updateHook: async (id, updates) => {
        try {
          const platformAPI = getPlatformAPI();
          const updatedHook = await platformAPI.hooks.updateHook(id, updates);

          set((state) => {
            const index = state.hooks.findIndex((h: MCPHook) => h.id === id);
            if (index !== -1) {
              state.hooks[index] = updatedHook;
            }
            if (state.selectedHook?.id === id) {
              state.selectedHook = updatedHook;
            }
          });
        } catch (error) {
          set((state) => {
            state.error =
              error instanceof Error ? error.message : "Failed to update hook";
          });
          throw error;
        }
      },

      // Delete a hook
      deleteHook: async (id) => {
        try {
          const platformAPI = getPlatformAPI();
          await platformAPI.hooks.deleteHook(id);

          set((state) => {
            state.hooks = state.hooks.filter((h: MCPHook) => h.id !== id);
            if (state.selectedHook?.id === id) {
              state.selectedHook = null;
            }
          });
        } catch (error) {
          set((state) => {
            state.error =
              error instanceof Error ? error.message : "Failed to delete hook";
          });
          throw error;
        }
      },

      // Enable/disable a hook
      setHookEnabled: async (id, enabled) => {
        try {
          const platformAPI = getPlatformAPI();
          const updatedHook = await platformAPI.hooks.setHookEnabled(
            id,
            enabled,
          );

          set((state) => {
            const index = state.hooks.findIndex((h: MCPHook) => h.id === id);
            if (index !== -1) {
              state.hooks[index] = updatedHook;
            }
            if (state.selectedHook?.id === id) {
              state.selectedHook = updatedHook;
            }
          });
        } catch (error) {
          set((state) => {
            state.error =
              error instanceof Error
                ? error.message
                : "Failed to update hook status";
          });
          throw error;
        }
      },

      // Reorder hooks
      reorderHooks: async (hookIds) => {
        try {
          const platformAPI = getPlatformAPI();
          const reorderedHooks = await platformAPI.hooks.reorderHooks(hookIds);

          set((state) => {
            state.hooks = reorderedHooks;
          });
        } catch (error) {
          set((state) => {
            state.error =
              error instanceof Error
                ? error.message
                : "Failed to reorder hooks";
          });
          throw error;
        }
      },

      // UI state management
      setSelectedHook: (hook) => {
        set((state) => {
          state.selectedHook = hook;
        });
      },

      clearError: () => {
        set((state) => {
          state.error = null;
        });
      },
    })),
  );
