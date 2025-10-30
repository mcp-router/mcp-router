import { create } from "zustand";
import { UIState, ToastMessage, DialogState } from "@mcp_router/shared";

interface UIStoreState extends UIState {
  // Actions for loading
  setGlobalLoading: (loading: boolean, message?: string) => void;

  // Actions for toasts
  addToast: (
    message: string,
    type?: ToastMessage["type"],
    duration?: number,
  ) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;

  // Actions for dialog
  openDialog: (config: Omit<DialogState, "isOpen">) => void;
  closeDialog: () => void;

  // Actions for navigation
  setCurrentPage: (page: string) => void;
  setSidebarOpen: (open: boolean) => void;

  // Actions for theme
  setTheme: (theme: UIState["theme"]) => void;

  // Utility methods
  showSuccessToast: (message: string) => void;
  showErrorToast: (message: string) => void;
  showWarningToast: (message: string) => void;
  showInfoToast: (message: string) => void;

  showConfirmDialog: (title: string, content: string) => Promise<boolean>;
}

export const useUIStore = create<UIStoreState>((set, get) => ({
  // Initial state
  globalLoading: false,
  loadingMessage: "",
  toasts: [],
  dialog: { isOpen: false },
  currentPage: "home",
  sidebarOpen: true,
  theme: "system",

  // Loading actions
  setGlobalLoading: (globalLoading, loadingMessage = "") =>
    set({ globalLoading, loadingMessage }),

  // Toast actions
  addToast: (message, type = "info", duration = 5000) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const toast: ToastMessage = { id, message, type, duration };

    set((state) => ({
      toasts: [...state.toasts, toast],
    }));

    // Auto-remove toast after duration
    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),

  clearToasts: () => set({ toasts: [] }),

  // Dialog actions
  openDialog: (config) =>
    set({
      dialog: { ...config, isOpen: true },
    }),

  closeDialog: () =>
    set({
      dialog: { isOpen: false },
    }),

  // Navigation actions
  setCurrentPage: (currentPage) => set({ currentPage }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

  // Theme actions
  setTheme: (theme) => {
    set({ theme });

    // Apply theme to document
    if (typeof window !== "undefined") {
      const root = window.document.documentElement;

      if (theme === "dark") {
        root.classList.add("dark");
      } else if (theme === "light") {
        root.classList.remove("dark");
      } else {
        // System theme
        const systemDark = window.matchMedia(
          "(prefers-color-scheme: dark)",
        ).matches;
        if (systemDark) {
          root.classList.add("dark");
        } else {
          root.classList.remove("dark");
        }
      }
    }
  },

  // Utility methods
  showSuccessToast: (message) => get().addToast(message, "success"),
  showErrorToast: (message) => get().addToast(message, "error"),
  showWarningToast: (message) => get().addToast(message, "warning"),
  showInfoToast: (message) => get().addToast(message, "info"),

  showConfirmDialog: (title, content) => {
    return new Promise<boolean>((resolve) => {
      get().openDialog({
        title,
        content,
        onConfirm: () => {
          get().closeDialog();
          resolve(true);
        },
        onCancel: () => {
          get().closeDialog();
          resolve(false);
        },
      });
    });
  },
}));
