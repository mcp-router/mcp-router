import { create } from "zustand";
import type { HookModule, PlatformAPI } from "@mcp_router/shared";
import { toast } from "sonner";

export interface HookStoreState {
  // Hook modules state
  modules: HookModule[];
  editingModule: HookModule | null;
  isCreating: boolean;
  formData: Partial<HookModule>;
  moduleManagerOpen: boolean;

  // Loading state
  isLoading: boolean;
  error: string | null;
}

export interface HookStoreActions {
  // Module management actions
  setModules: (modules: HookModule[]) => void;
  setEditingModule: (module: HookModule | null) => void;
  setIsCreating: (isCreating: boolean) => void;
  setFormData: (formData: Partial<HookModule>) => void;
  updateFormData: (updates: Partial<HookModule>) => void;
  setModuleManagerOpen: (open: boolean) => void;

  // API actions with platform API
  loadModules: (platformAPI: PlatformAPI) => Promise<void>;
  handleCreate: (platformAPI: PlatformAPI) => Promise<void>;
  handleUpdate: (platformAPI: PlatformAPI) => Promise<void>;
  handleDelete: (platformAPI: PlatformAPI, id: string) => Promise<void>;

  // CRUD actions (local state)
  addModule: (module: HookModule) => void;
  updateModule: (id: string, updates: Partial<HookModule>) => void;
  removeModule: (id: string) => void;

  // Edit mode actions
  startEdit: (module: HookModule) => void;
  startCreate: () => void;
  resetForm: () => void;

  // Loading and error actions
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;

  // Utility actions
  resetStore: () => void;
}

export type HookStore = HookStoreState & HookStoreActions;

const initialFormData: Partial<HookModule> = {
  name: "",
  script: "",
};

const initialState: HookStoreState = {
  modules: [],
  editingModule: null,
  isCreating: false,
  formData: initialFormData,
  moduleManagerOpen: false,
  isLoading: false,
  error: null,
};

export const useHookStore = create<HookStore>((set, get) => ({
  ...initialState,

  // Module management actions
  setModules: (modules) => set({ modules }),
  setEditingModule: (module) => set({ editingModule: module }),
  setIsCreating: (isCreating) => set({ isCreating }),
  setFormData: (formData) => set({ formData }),
  updateFormData: (updates) =>
    set((state) => ({
      formData: { ...state.formData, ...updates },
    })),
  setModuleManagerOpen: (open) => set({ moduleManagerOpen: open }),

  // API actions with platform API
  loadModules: async (platformAPI: PlatformAPI) => {
    set({ isLoading: true });
    try {
      const userModules = await platformAPI.workflows.hooks.list();
      set({ modules: userModules, error: null });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to load modules";
      set({ error: errorMessage });
      console.error("Failed to load modules:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  handleCreate: async (platformAPI: PlatformAPI) => {
    const { formData } = get();
    if (!formData.name || !formData.script) return;

    set({ isLoading: true });
    try {
      await platformAPI.workflows.hooks.create({
        name: formData.name,
        script: formData.script,
      });
      // Reload modules after creation
      const updatedModules = await platformAPI.workflows.hooks.list();
      set({
        modules: updatedModules,
        isCreating: false,
        editingModule: null,
        formData: initialFormData,
        error: null,
      });
      toast.success("Module created successfully");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create module";
      set({ error: errorMessage });
      toast.error(errorMessage);
      console.error("Failed to create module:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  handleUpdate: async (platformAPI: PlatformAPI) => {
    const { editingModule, formData } = get();
    if (!editingModule || !formData.name || !formData.script) return;

    set({ isLoading: true });
    try {
      await platformAPI.workflows.hooks.update(editingModule.id, formData);
      // Reload modules after update
      const updatedModules = await platformAPI.workflows.hooks.list();
      set({
        modules: updatedModules,
        isCreating: false,
        editingModule: null,
        formData: initialFormData,
        error: null,
      });
      toast.success("Module updated successfully");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update module";
      set({ error: errorMessage });
      toast.error(errorMessage);
      console.error("Failed to update module:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  handleDelete: async (platformAPI: PlatformAPI, id: string) => {
    set({ isLoading: true });
    try {
      await platformAPI.workflows.hooks.delete(id);
      // Reload modules after deletion
      const updatedModules = await platformAPI.workflows.hooks.list();
      set({ modules: updatedModules, error: null });
      toast.success("Module deleted successfully");
    } catch (error: any) {
      const message = error?.message || "Failed to delete hook module";
      set({ error: message });
      toast.error(message);
      console.error("Failed to delete module:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  // CRUD actions (local state)
  addModule: (module) =>
    set((state) => ({
      modules: [...state.modules, module],
    })),

  updateModule: (id, updates) =>
    set((state) => ({
      modules: state.modules.map((m) =>
        m.id === id ? { ...m, ...updates } : m,
      ),
      editingModule:
        state.editingModule?.id === id
          ? { ...state.editingModule, ...updates }
          : state.editingModule,
    })),

  removeModule: (id) =>
    set((state) => ({
      modules: state.modules.filter((m) => m.id !== id),
      editingModule:
        state.editingModule?.id === id ? null : state.editingModule,
    })),

  // Edit mode actions
  startEdit: (module) =>
    set({
      editingModule: module,
      formData: {
        name: module.name,
        script: module.script,
      },
      isCreating: false,
    }),

  startCreate: () =>
    set({
      isCreating: true,
      editingModule: null,
      formData: initialFormData,
    }),

  resetForm: () =>
    set({
      isCreating: false,
      editingModule: null,
      formData: initialFormData,
    }),

  // Loading and error actions
  setIsLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  // Utility actions
  resetStore: () => set(initialState),
}));
