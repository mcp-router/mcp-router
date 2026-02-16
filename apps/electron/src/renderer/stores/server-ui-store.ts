import { create } from "zustand";
import { ServerUIState } from "@mcp_router/shared";

export interface ServerUIStoreState extends ServerUIState {
  setSearchQuery: (query: string) => void;
  setExpandedServerId: (id: string | null) => void;
  setSelectedServerId: (id: string | null) => void;
  clearUI: () => void;
}

const initialState: ServerUIState = {
  searchQuery: "",
  expandedServerId: null,
  selectedServerId: null,
};

export const useServerUIStore = create<ServerUIStoreState>((set) => ({
  ...initialState,

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setExpandedServerId: (expandedServerId) => set({ expandedServerId }),
  setSelectedServerId: (selectedServerId) => set({ selectedServerId }),
  clearUI: () => set(initialState),
}));
