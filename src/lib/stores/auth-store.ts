import { create } from 'zustand';
import { AppSettings } from '../types/settings-types';

interface UserInfo {
  userId: string;
  name: string;
  creditBalance: number;
  paidCreditBalance: number;
}

interface AuthState {
  // Authentication data
  isAuthenticated: boolean;
  isActivated: boolean;
  userId: string | null;
  authToken: string | null;
  activationCode: string | null;
  userInfo: UserInfo | null;
  
  // Login state
  isLoggingIn: boolean;
  isActivating: boolean;
  
  // Error states
  loginError: string | null;
  activationError: string | null;
  
  // Credit information (if applicable)
  credits: number | null;
  
  // Actions
  setAuthenticated: (authenticated: boolean) => void;
  setActivated: (activated: boolean) => void;
  setUserData: (userData: Partial<Pick<AuthState, 'userId' | 'authToken' | 'activationCode'>>) => void;
  setUserInfo: (userInfo: UserInfo | null) => void;
  setCredits: (credits: number) => void;
  
  // Loading actions
  setLoggingIn: (loading: boolean) => void;
  setActivating: (loading: boolean) => void;
  
  // Error actions
  setLoginError: (error: string | null) => void;
  setActivationError: (error: string | null) => void;
  clearErrors: () => void;
  
  // Auth operations
  login: () => Promise<void>;
  logout: () => Promise<void>;
  activate: (invitationCode: string) => Promise<void>;
  checkAuthStatus: (forceRefresh?: boolean) => Promise<void>;
  refreshCredits: () => Promise<void>;
  subscribeToAuthChanges: () => () => void;
  
  // Initialize from settings
  initializeFromSettings: (settings: AppSettings) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  isAuthenticated: false,
  isActivated: false,
  userId: null,
  authToken: null,
  activationCode: null,
  userInfo: null,
  isLoggingIn: false,
  isActivating: false,
  loginError: null,
  activationError: null,
  credits: null,

  // Basic state setters
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  
  setActivated: (isActivated) => set({ isActivated }),
  
  setUserData: (userData) => set((state) => ({ ...state, ...userData })),
  
  setUserInfo: (userInfo) => set({ userInfo }),
  
  setCredits: (credits) => set({ credits }),
  
  setLoggingIn: (isLoggingIn) => set({ isLoggingIn }),
  
  setActivating: (isActivating) => set({ isActivating }),
  
  setLoginError: (loginError) => set({ loginError }),
  
  setActivationError: (activationError) => set({ activationError }),
  
  clearErrors: () => set({ loginError: null, activationError: null }),

  // Auth operations with Electron API integration
  login: async () => {
    const { setLoggingIn, setLoginError } = get();
    
    try {
      setLoggingIn(true);
      setLoginError(null);
      
      // Call Electron API to start login flow
      await window.electronAPI.login();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Login failed');
      throw error;
    } finally {
      setLoggingIn(false);
    }
  },

  logout: async () => {
    const { setAuthenticated, setUserData, setUserInfo, clearErrors } = get();
    
    try {
      // Call Electron API to clear stored auth data
      await window.electronAPI.logout();
      
      // Clear local state
      setAuthenticated(false);
      setUserData({ 
        authToken: null, 
        userId: null 
      });
      setUserInfo(null);
      clearErrors();
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local state even if API call fails
      setAuthenticated(false);
      setUserData({ 
        authToken: null, 
        userId: null 
      });
      setUserInfo(null);
    }
  },

  activate: async (invitationCode) => {
    const { setActivating, setActivationError, setActivated, setUserData, checkAuthStatus } = get();
    
    try {
      setActivating(true);
      setActivationError(null);
      
      // Call Electron API to activate with the code
      const result = await window.electronAPI.submitInvitationCode(invitationCode);
      
      if (result) {
        setUserData({ 
          invitationCode
        });
        setActivated(true);
        
        // Re-check auth status to get the latest activation state
        await checkAuthStatus();
      } else {
        throw new Error('Activation failed');
      }
    } catch (error) {
      setActivationError(error instanceof Error ? error.message : 'Activation failed');
      setActivated(false);
      throw error;
    } finally {
      setActivating(false);
    }
  },

  checkAuthStatus: async (forceRefresh = false) => {
    const { setAuthenticated, setActivated, setUserData, setUserInfo, setCredits } = get();
    
    try {
      // First check activation status
      const isActivated = await window.electronAPI.checkActivation();
      setActivated(isActivated);
      
      // Then check auth status with optional force refresh
      const status = await window.electronAPI.getAuthStatus(forceRefresh);
      
      setAuthenticated(status.authenticated);
      setUserData({
        userId: status.userId,
        authToken: status.token,
      });
      
      // Set user info if authenticated
      if (status.authenticated && status.user) {
        const newUserInfo = {
          userId: status.userId || '',
          name: status.user.name || '',
          creditBalance: status.user.creditBalance || 0,
          paidCreditBalance: status.user.paidCreditBalance || 0,
        };
        setUserInfo(newUserInfo);
      } else {
        setUserInfo(null);
      }
    } catch (error) {
      console.error('Failed to check auth status:', error);
      // Reset to unauthenticated state on error
      setAuthenticated(false);
      setActivated(false);
      setUserData({ 
        userId: null, 
        authToken: null, 
        activationCode: null 
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
      const status = await window.electronAPI.getAuthStatus();
      // Credits are now part of user info
      if (status.authenticated && status.user) {
        setCredits(status.user.creditBalance || 0);
      }
    } catch (error) {
      console.error('Failed to refresh credits:', error);
      // Don't throw error for credits refresh failure
    }
  },

  subscribeToAuthChanges: () => {
    const { setAuthenticated, setUserInfo } = get();
    
    // Subscribe to auth status changes from Electron
    const unsubscribe = window.electronAPI.onAuthStatusChanged((status: { 
      loggedIn: boolean; 
      userId?: string; 
      name?: string;
      user?: any;
    }) => {
      setAuthenticated(status.loggedIn);
      if (status.loggedIn) {
        setUserInfo({
          userId: status.userId || '',
          name: status.name || status.user?.name || '',
          creditBalance: status.user?.creditBalance || 0,
          paidCreditBalance: status.user?.paidCreditBalance || 0,
        });
      } else {
        setUserInfo(null);
      }
    });
    
    return unsubscribe;
  },

  initializeFromSettings: async (settings) => {
    const { setAuthenticated, setActivated, setUserData } = get();
    
    const isAuthenticated = !!(settings.authToken && settings.userId);
    
    // Use checkActivation to determine activation status
    const isActivated = await window.electronAPI.checkActivation();
    
    setAuthenticated(isAuthenticated);
    setActivated(isActivated);
    setUserData({
      userId: settings.userId || null,
      authToken: settings.authToken || null,
      activationCode: settings.activationCode || null,
    });
  },
}));

// Utility selectors
export const useIsLoggedIn = () =>
  useAuthStore((state) => state.isAuthenticated && state.authToken);

export const useIsActivated = () =>
  useAuthStore((state) => state.isActivated && state.activationCode);

export const useAuthToken = () =>
  useAuthStore((state) => state.authToken);

export const useUserId = () =>
  useAuthStore((state) => state.userId);