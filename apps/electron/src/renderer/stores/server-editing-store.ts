import { create } from "zustand";

interface ServerEditingState {
  // Editing state
  isAdvancedEditing: boolean;
  isLoading: boolean;

  // Edited values
  editedName: string;
  editedCommand: string;
  editedArgs: string[];
  editedBearerToken: string;
  editedAutoStart: boolean;
  envPairs: { key: string; value: string }[];
  editedToolPermissions: Record<string, boolean>;

  // Actions
  setIsAdvancedEditing: (isEditing: boolean) => void;
  setIsLoading: (isLoading: boolean) => void;
  setEditedName: (name: string) => void;
  setEditedCommand: (command: string) => void;
  setEditedArgs: (args: string[]) => void;
  setEditedBearerToken: (token: string) => void;
  setEditedAutoStart: (autoStart: boolean) => void;
  setEnvPairs: (pairs: { key: string; value: string }[]) => void;
  setEditedToolPermissions: (
    permissions:
      | Record<string, boolean>
      | ((prev: Record<string, boolean>) => Record<string, boolean>),
  ) => void;

  // Array manipulation actions
  updateArg: (index: number, value: string) => void;
  removeArg: (index: number) => void;
  addArg: () => void;

  updateEnvPair: (index: number, field: "key" | "value", value: string) => void;
  removeEnvPair: (index: number) => void;
  addEnvPair: () => void;

  // Initialize editing state from server
  initializeFromServer: (server: {
    name?: string;
    command?: string;
    args?: string[];
    bearerToken?: string;
    autoStart?: boolean;
    env?: Record<string, string | boolean | number>;
    toolPermissions?: Record<string, boolean>;
  }) => void;

  // Reset state
  reset: () => void;
}

export const useServerEditingStore = create<ServerEditingState>((set) => ({
  // Initial state
  isAdvancedEditing: false,
  isLoading: false,
  editedName: "",
  editedCommand: "",
  editedArgs: [],
  editedBearerToken: "",
  editedAutoStart: false,
  envPairs: [],
  editedToolPermissions: {},

  // Basic setters
  setIsAdvancedEditing: (isAdvancedEditing) => set({ isAdvancedEditing }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setEditedName: (editedName) => set({ editedName }),
  setEditedCommand: (editedCommand) => set({ editedCommand }),
  setEditedArgs: (editedArgs) => set({ editedArgs }),
  setEditedBearerToken: (editedBearerToken) => set({ editedBearerToken }),
  setEditedAutoStart: (editedAutoStart) => set({ editedAutoStart }),
  setEnvPairs: (envPairs) => set({ envPairs }),
  setEditedToolPermissions: (permissions) =>
    set((state) => ({
      editedToolPermissions:
        typeof permissions === "function"
          ? permissions(state.editedToolPermissions)
          : permissions,
    })),

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
      editedName: server.name || "",
      editedCommand: server.command || "",
      editedArgs: server.args || [],
      editedBearerToken: server.bearerToken || "",
      editedAutoStart: server.autoStart || false,
      envPairs: Object.entries(server.env || {}).map(([key, value]) => ({
        key,
        value: String(value),
      })),
      editedToolPermissions: { ...(server.toolPermissions || {}) },
    });
  },

  // Reset state
  reset: () =>
    set({
      isAdvancedEditing: false,
      isLoading: false,
      editedName: "",
      editedCommand: "",
      editedArgs: [],
      editedBearerToken: "",
      editedAutoStart: false,
      envPairs: [],
      editedToolPermissions: {},
    }),
}));
