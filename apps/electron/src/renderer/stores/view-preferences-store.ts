import { create } from "zustand";
import { persist } from "zustand/middleware";

type ViewMode = "list" | "grid";

interface ViewPreferencesState {
  serverViewMode: ViewMode;
  setServerViewMode: (mode: ViewMode) => void;
}

export const useViewPreferencesStore = create<ViewPreferencesState>()(
  persist(
    (set) => ({
      serverViewMode: "list",
      setServerViewMode: (mode) => set({ serverViewMode: mode }),
    }),
    {
      name: "view-preferences",
    },
  ),
);
