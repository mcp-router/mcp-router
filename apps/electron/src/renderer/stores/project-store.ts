import { create } from "zustand";
import type { Project } from "@mcp_router/shared";
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
  create: (input: { name: string; color?: string }) => Promise<Project>;
  update: (
    id: string,
    updates: { name?: string; color?: string },
  ) => Promise<Project>;
  delete: (id: string) => Promise<void>;

  // UI state actions
  setCollapsed: (projectId: string, collapsed: boolean) => void;
  setSelectedProjectId: (id: string | null) => void;
}

const COLLAPSE_STORAGE_KEY = "mcpr:projects:collapsed:v1";
export const UNASSIGNED_PROJECT_ID = "__unassigned__";

function loadCollapsed(): CollapsedState {
  try {
    const raw = localStorage.getItem(COLLAPSE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CollapsedState) : {};
  } catch {
    return {};
  }
}

function saveCollapsed(state: CollapsedState) {
  try {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
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
      }
    } catch (error) {
      set({
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

  setSelectedProjectId: (id) => set({ selectedProjectId: id }),
}));
