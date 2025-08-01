import { create, StoreApi, UseBoundStore } from "zustand";
import { AppSettings, AuthStoreState, UserInfo } from "@mcp_router/shared";
import { PlatformAPI } from "@/main/infrastructure/platform-api";

export interface AuthStoreInterface extends AuthStoreState {
  // Actions
  setAuthenticated: (authenticated: boolean) => void;
  setUserData: (
    userData: Partial<Pick<AuthStoreState, "userId" | "authToken">>,
  ) => void;
  setUserInfo: (userInfo: UserInfo | null) => void;
  setCredits: (credits: number) => void;

  // Loading actions
  setLoggingIn: (loading: boolean) => void;

  // Error actions
  setLoginError: (error: string | null) => void;
  clearErrors: () => void;

  // Auth operations
  login: () => Promise<void>;
  logout: () => Promise<void>;
  checkAuthStatus: (forceRefresh?: boolean) => Promise<void>;
  refreshCredits: () => Promise<void>;
  subscribeToAuthChanges: () => () => void;

  // Initialize from settings
  initializeFromSettings: (settings: AppSettings) => void;

  // Store management
  clearStore: () => void;
}

export const createAuthStore = (
  getPlatformAPI: () => PlatformAPI,
): UseBoundStore<StoreApi<AuthStoreInterface>> =>
  create<AuthStoreInterface>((set, get) => ({
    // Initial state
    isAuthenticated: false,
    userId: null,
    authToken: null,
    userInfo: null,
    isLoggingIn: false,
    loginError: null,
    credits: null,

    // Basic state setters
    setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),

    setUserData: (userData) => set((state) => ({ ...state, ...userData })),

    setUserInfo: (userInfo) => set({ userInfo }),

    setCredits: (credits) => set({ credits }),

    setLoggingIn: (isLoggingIn) => set({ isLoggingIn }),

    setLoginError: (loginError) => set({ loginError }),

    clearErrors: () => set({ loginError: null }),

    // Auth operations with Platform API integration
    login: async () => {
      const { setLoggingIn, setLoginError } = get();

      try {
        setLoggingIn(true);
        setLoginError(null);

        // Call Platform API to start login flow
        await getPlatformAPI().auth.signIn();
      } catch (error) {
        setLoginError(error instanceof Error ? error.message : "Login failed");
        throw error;
      } finally {
        setLoggingIn(false);
      }
    },

    logout: async () => {
      const { setAuthenticated, setUserData, setUserInfo, clearErrors } = get();

      try {
        // Call Platform API to clear stored auth data
        await getPlatformAPI().auth.signOut();

        // Clear local state
        setAuthenticated(false);
        setUserData({
          authToken: null,
          userId: null,
        });
        setUserInfo(null);
        clearErrors();
      } catch (error) {
        console.error("Logout error:", error);
        // Still clear local state even if API call fails
        setAuthenticated(false);
        setUserData({
          authToken: null,
          userId: null,
        });
        setUserInfo(null);
      }
    },

    checkAuthStatus: async (forceRefresh = false) => {
      const { setAuthenticated, setUserData, setUserInfo, setCredits } = get();

      try {
        // Check auth status with optional force refresh
        const status = await getPlatformAPI().auth.getStatus(forceRefresh);

        setAuthenticated(status.authenticated);
        setUserData({
          userId: status.userId,
          authToken: status.token,
        });

        // Set user info if authenticated
        if (status.authenticated && status.user) {
          const newUserInfo = {
            userId: status.userId || "",
            name: status.user.name || "",
            creditBalance: status.user.creditBalance || 0,
            paidCreditBalance: status.user.paidCreditBalance || 0,
          };
          setUserInfo(newUserInfo);
        } else {
          setUserInfo(null);
        }
      } catch (error) {
        console.error("Failed to check auth status:", error);
        // Reset to unauthenticated state on error
        setAuthenticated(false);
        setUserData({
          userId: null,
          authToken: null,
        });
      }
    },

    refreshCredits: async () => {
      const { authToken, setCredits } = get();

      if (!authToken) {
        return;
      }

      try {
        // Refresh credits by getting the full auth status
        const status = await getPlatformAPI().auth.getStatus();
        // Credits are now part of user info
        if (status.authenticated && status.user) {
          setCredits(status.user.creditBalance || 0);
        }
      } catch (error) {
        console.error("Failed to refresh credits:", error);
        // Don't throw error for credits refresh failure
      }
    },

    subscribeToAuthChanges: () => {
      const { setAuthenticated, setUserInfo, setUserData } = get();

      // Subscribe to auth status changes from Platform API
      const unsubscribe = getPlatformAPI().auth.onChange((status) => {
        setAuthenticated(status.authenticated);
        if (status.authenticated && status.user) {
          setUserInfo({
            userId: status.userId || "",
            name: status.user?.name || "",
            creditBalance: status.user?.creditBalance || 0,
            paidCreditBalance: status.user?.paidCreditBalance || 0,
          });
          setUserData({
            userId: status.userId,
          });
        } else {
          setUserInfo(null);
          setUserData({
            userId: null,
          });
        }
      });

      return unsubscribe;
    },

    initializeFromSettings: async (settings) => {
      const { setAuthenticated, setUserData } = get();

      const isAuthenticated = !!(settings.authToken && settings.userId);

      setAuthenticated(isAuthenticated);
      setUserData({
        userId: settings.userId || null,
        authToken: settings.authToken || null,
      });
    },

    clearStore: () => {
      set({
        isAuthenticated: false,
        userId: null,
        authToken: null,
        userInfo: null,
        isLoggingIn: false,
        loginError: null,
        credits: null,
      });
    },
  }));

// Utility selector creators
export const createAuthSelectors = <
  T extends ReturnType<typeof createAuthStore>,
>(
  useStore: T,
) => ({
  useIsLoggedIn: () =>
    useStore((state) => state.isAuthenticated && state.authToken),

  useAuthToken: () => useStore((state) => state.authToken),

  useUserId: () => useStore((state) => state.userId),
});
