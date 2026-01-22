import { create } from "zustand";
import type { Project, ProjectOptimization } from "@mcp_router/shared";
import { UNASSIGNED_PROJECT_ID as SHARED_UNASSIGNED_PROJECT_ID } from "@mcp_router/shared";
import { useWorkspaceStore } from "./workspace-store";

type CollapsedState = Record<string, boolean>; // projectId -> collapsed

interface ProjectStoreState {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  collapsedByProjectId: CollapsedState;
  selectedProjectId: string | null; // null = All, "__unassigned__" = Unassigned

  // Actions
  list: () => Promise<void>;
  create: (input: { name: string }) => Promise<Project>;
  update: (
    id: string,
    updates: { name?: string; optimization?: ProjectOptimization },
  ) => Promise<Project>;
  delete: (id: string) => Promise<void>;

  // UI state actions
  setCollapsed: (projectId: string, collapsed: boolean) => void;
  setSelectedProjectId: (id: string | null) => void;
}

const COLLAPSE_STORAGE_KEY = "mcpr:projects:collapsed:v1";
const SELECTED_PROJECT_STORAGE_KEY = "mcpr:projects:selected:v1";
export const UNASSIGNED_PROJECT_ID = SHARED_UNASSIGNED_PROJECT_ID;

function loadCollapsed(): CollapsedState {
  const raw = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as CollapsedState) : {};
}

function saveCollapsed(state: CollapsedState) {
  window.localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(state));
}

function sortProjects(projects: Project[]): Project[] {
  return projects.slice().sort((a, b) => a.name.localeCompare(b.name));
}

function getPlatformAPI() {
  return useWorkspaceStore.getState().getPlatformAPI();
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  projects: [],
  isLoading: false,
  error: null,
  collapsedByProjectId: loadCollapsed(),
  selectedProjectId: null,

  list: async () => {
    set({ isLoading: true, error: null });
    try {
      const projects = await getPlatformAPI().projects.list();
      set({
        projects: sortProjects(projects),
        isLoading: false,
        error: null,
      });
      const { selectedProjectId } = get();
      if (
        selectedProjectId &&
        selectedProjectId !== UNASSIGNED_PROJECT_ID &&
        !projects.some((p) => p.id === selectedProjectId)
      ) {
        set({ selectedProjectId: null });
        window.localStorage.removeItem(SELECTED_PROJECT_STORAGE_KEY);
      }
    } catch (error) {
      set({
        projects: [],
        error:
          error instanceof Error ? error.message : "Failed to load projects",
        isLoading: false,
      });
    }
  },

  create: async (input) => {
    set({ error: null });
    const project = await getPlatformAPI().projects.create(input);
    set((state) => ({
      projects: sortProjects([...state.projects, project]),
    }));
    return project;
  },

  update: async (id, updates) => {
    set({ error: null });
    const updated = await getPlatformAPI().projects.update(id, updates);
    set((state) => ({
      projects: sortProjects(
        state.projects.map((p) => (p.id === id ? updated : p)),
      ),
    }));
    return updated;
  },

  delete: async (id) => {
    set({ error: null });
    await getPlatformAPI().projects.delete(id);
    set((state) => {
      const projects = state.projects.filter((p) => p.id !== id);
      const selectedProjectId =
        state.selectedProjectId === id ? null : state.selectedProjectId;
      return { projects, selectedProjectId };
    });
  },

  setCollapsed: (projectId, collapsed) => {
    set((state) => {
      const next = { ...state.collapsedByProjectId, [projectId]: collapsed };
      saveCollapsed(next);
      return { collapsedByProjectId: next };
    });
  },

  setSelectedProjectId: (id) =>
    set(() => {
      if (id === null) {
        window.localStorage.removeItem(SELECTED_PROJECT_STORAGE_KEY);
      } else {
        window.localStorage.setItem(
          SELECTED_PROJECT_STORAGE_KEY,
          JSON.stringify(id),
        );
      }
      return { selectedProjectId: id };
    }),
}));

// Initialize selected project from storage on first import
const raw = window.localStorage.getItem(SELECTED_PROJECT_STORAGE_KEY);
if (raw) {
  const parsed: unknown = JSON.parse(raw);
  if (parsed === null || typeof parsed === "string") {
    useProjectStore.setState({ selectedProjectId: parsed as string | null });
  }
}
