// Export all stores for easy importing
export { useServerStore, useServerById, useServersByStatus, useIsServerUpdating } from './server-store';
export { useAuthStore, useIsLoggedIn, useIsActivated, useAuthToken, useUserId } from './auth-store';
export { useAgentStore, useCurrentAgent, useCurrentSession, useSessionsByAgent } from './agent-store';
export { useUIStore, useToasts, useDialog, useGlobalLoading, useTheme } from './ui-store';

// Store initialization utility
export const initializeStores = async () => {
  const { useAuthStore } = await import('./auth-store');
  const { useServerStore } = await import('./server-store');
  const { useAgentStore } = await import('./agent-store');
  
  // Initialize auth state from settings
  try {
    const settings = await window.electronAPI.getSettings();
    await useAuthStore.getState().initializeFromSettings(settings);
  } catch (error) {
    console.error('Failed to initialize auth from settings:', error);
  }
  
  // Check current auth status
  try {
    await useAuthStore.getState().checkAuthStatus();
  } catch (error) {
    console.error('Failed to check auth status:', error);
  }
  
  // Load initial server data
  try {
    await useServerStore.getState().refreshServers();
  } catch (error) {
    console.error('Failed to load initial servers:', error);
  }
  
  // Load initial agent data
  try {
    await useAgentStore.getState().refreshAgents();
  } catch (error) {
    console.error('Failed to load initial agents:', error);
  }
};