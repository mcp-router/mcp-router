import { UserInfo } from "../auth";

// Toast and notification types
export interface ToastMessage {
  id: string;
  message: string;
  type: "success" | "error" | "warning" | "info";
  duration?: number;
}

// Dialog types
export interface DialogState {
  isOpen: boolean;
  title?: string;
  content?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

// Theme types
export type Theme = "light" | "dark" | "system";

// Store state interfaces
export interface ServerState {
  // Server data
  servers: any[]; // MCPServer[]

  // Loading states
  isLoading: boolean;
  isUpdating: string[]; // Array of server IDs being updated

  // Error states
  error: string | null;

  // UI state
  searchQuery: string;
  expandedServerId: string | null;
  selectedServerId: string | null;
}

export interface UIState {
  // Loading states
  globalLoading: boolean;
  loadingMessage: string;

  // Toast notifications
  toasts: ToastMessage[];

  // Dialog state
  dialog: DialogState;

  // Navigation state
  currentPage: string;
  sidebarOpen: boolean;

  // Theme
  theme: Theme;
}

export interface AuthStoreState {
  // Authentication data
  isAuthenticated: boolean;
  userId: string | null;
  authToken: string | null;
  userInfo: UserInfo | null;

  // Login state
  isLoggingIn: boolean;

  // Error states
  loginError: string | null;
}
