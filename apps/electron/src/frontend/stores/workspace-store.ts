import { create } from "zustand";
import { Workspace } from "@/lib/platform-api";
import { electronPlatformAPI } from "../lib/electron-platform-api";

interface WorkspaceState {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadWorkspaces: () => Promise<void>;
  loadCurrentWorkspace: () => Promise<void>;
  createWorkspace: (config: any) => Promise<Workspace>;
  updateWorkspace: (id: string, updates: any) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  switchWorkspace: (id: string) => Promise<void>;
  setCurrentWorkspace: (workspace: Workspace) => void;
  setError: (error: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  currentWorkspace: null,
  isLoading: false,
  error: null,

  loadWorkspaces: async () => {
    set({ isLoading: true, error: null });
    try {
      const workspaces = await electronPlatformAPI.workspaces.list();
      set({ workspaces, isLoading: false });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "ワークスペースの読み込みに失敗しました",
        isLoading: false,
      });
    }
  },

  loadCurrentWorkspace: async () => {
    try {
      const workspace = await electronPlatformAPI.workspaces.getActive();
      set({ currentWorkspace: workspace });
    } catch (error) {
      console.error("Failed to load current workspace:", error);
    }
  },

  createWorkspace: async (config) => {
    set({ isLoading: true, error: null });
    try {
      const newWorkspace = await electronPlatformAPI.workspaces.create(config);
      const workspaces = [...get().workspaces, newWorkspace];
      set({ workspaces, isLoading: false });
      return newWorkspace;
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "ワークスペースの作成に失敗しました",
        isLoading: false,
      });
      throw error;
    }
  },

  updateWorkspace: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const updatedWorkspace = await electronPlatformAPI.workspaces.update(
        id,
        updates,
      );
      const workspaces = get().workspaces.map((w) =>
        w.id === id ? updatedWorkspace : w,
      );
      set({ workspaces, isLoading: false });

      // 現在のワークスペースが更新された場合
      if (get().currentWorkspace?.id === id) {
        set({ currentWorkspace: updatedWorkspace });
      }
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "ワークスペースの更新に失敗しました",
        isLoading: false,
      });
      throw error;
    }
  },

  deleteWorkspace: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await electronPlatformAPI.workspaces.delete(id);
      const workspaces = get().workspaces.filter((w) => w.id !== id);
      set({ workspaces, isLoading: false });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "ワークスペースの削除に失敗しました",
        isLoading: false,
      });
      throw error;
    }
  },

  switchWorkspace: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await electronPlatformAPI.workspaces.setActive(id);
      const workspace = get().workspaces.find((w) => w.id === id);
      if (workspace) {
        set({ currentWorkspace: workspace, isLoading: false });

        // ストアの再初期化をトリガー
        // サーバーストアなど他のストアのデータを再読み込み
        const { initializeStores } = await import("../stores");
        await initializeStores();
      }
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "ワークスペースの切り替えに失敗しました",
        isLoading: false,
      });
      throw error;
    }
  },

  setCurrentWorkspace: (workspace) => {
    set({ currentWorkspace: workspace });
  },

  setError: (error) => {
    set({ error });
  },
}));

// ワークスペース切り替えイベントのリスナー設定
if (typeof window !== "undefined" && window.electronAPI) {
  window.electronAPI.onWorkspaceSwitched((workspace: Workspace) => {
    useWorkspaceStore.getState().setCurrentWorkspace(workspace);
  });
}
