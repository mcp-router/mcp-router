import { create } from "zustand";

interface ServerEditingState {
  // Editing state
  isAdvancedEditing: boolean;
  isLoading: boolean;

  // Edited values
  editedCommand: string;
  editedArgs: string[];
  editedBearerToken: string;
  envPairs: { key: string; value: string }[];

  // Actions
  setIsAdvancedEditing: (isEditing: boolean) => void;
  setIsLoading: (isLoading: boolean) => void;
  setEditedCommand: (command: string) => void;
  setEditedArgs: (args: string[]) => void;
  setEditedBearerToken: (token: string) => void;
  setEnvPairs: (pairs: { key: string; value: string }[]) => void;

  // Array manipulation actions
  updateArg: (index: number, value: string) => void;
  removeArg: (index: number) => void;
  addArg: () => void;

  updateEnvPair: (index: number, field: "key" | "value", value: string) => void;
  removeEnvPair: (index: number) => void;
  addEnvPair: () => void;

  // Initialize editing state from server
  initializeFromServer: (server: {
    command?: string;
    args?: string[];
    bearerToken?: string;
    env?: Record<string, string | boolean | number>;
  }) => void;

  // Reset state
  reset: () => void;
}

export const useServerEditingStore = create<ServerEditingState>((set) => ({
  // Initial state
  isAdvancedEditing: false,
  isLoading: false,
  editedCommand: "",
  editedArgs: [],
  editedBearerToken: "",
  envPairs: [],

  // Basic setters
  setIsAdvancedEditing: (isAdvancedEditing) => set({ isAdvancedEditing }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setEditedCommand: (editedCommand) => set({ editedCommand }),
  setEditedArgs: (editedArgs) => set({ editedArgs }),
  setEditedBearerToken: (editedBearerToken) => set({ editedBearerToken }),
  setEnvPairs: (envPairs) => set({ envPairs }),

  // Array manipulation
  updateArg: (index, value) =>
    set((state) => {
      const newArgs = [...state.editedArgs];
      newArgs[index] = value;
      return { editedArgs: newArgs };
    }),

  removeArg: (index) =>
    set((state) => ({
      editedArgs: state.editedArgs.filter((_, i) => i !== index),
    })),

  addArg: () =>
    set((state) => ({
      editedArgs: [...state.editedArgs, ""],
    })),

  updateEnvPair: (index, field, value) =>
    set((state) => {
      const newPairs = [...state.envPairs];
      newPairs[index][field] = value;
      return { envPairs: newPairs };
    }),

  removeEnvPair: (index) =>
    set((state) => ({
      envPairs: state.envPairs.filter((_, i) => i !== index),
    })),

  addEnvPair: () =>
    set((state) => ({
      envPairs: [...state.envPairs, { key: "", value: "" }],
    })),

  // Initialize from server
  initializeFromServer: (server) => {
    set({
      editedCommand: server.command || "",
      editedArgs: server.args || [],
      editedBearerToken: server.bearerToken || "",
      envPairs: Object.entries(server.env || {}).map(([key, value]) => ({
        key,
        value: String(value),
      })),
    });
  },

  // Reset state
  reset: () =>
    set({
      isAdvancedEditing: false,
      isLoading: false,
      editedCommand: "",
      editedArgs: [],
      editedBearerToken: "",
      envPairs: [],
    }),
}));
