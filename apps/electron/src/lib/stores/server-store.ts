import { create } from 'zustand';
import { MCPServer, MCPServerConfig } from '../../types';

interface ServerState {
  // Server data
  servers: MCPServer[];
  
  // Loading states
  isLoading: boolean;
  isUpdating: string[]; // Array of server IDs being updated
  
  // Error states
  error: string | null;
  
  // UI state
  searchQuery: string;
  expandedServerId: string | null;
  selectedServerId: string | null;
  
  // Actions
  setServers: (servers: MCPServer[]) => void;
  addServer: (server: MCPServer) => void;
  updateServer: (id: string, updates: Partial<MCPServer>) => void;
  removeServer: (id: string) => void;
  setServerStatus: (id: string, status: MCPServer['status']) => void;
  
  
  // Loading actions
  setLoading: (loading: boolean) => void;
  setUpdating: (serverId: string, updating: boolean) => void;
  
  // Error actions
  setError: (error: string | null) => void;
  
  // UI actions
  setSearchQuery: (query: string) => void;
  setExpandedServerId: (id: string | null) => void;
  setSelectedServerId: (id: string | null) => void;
  
  // Server operations
  startServer: (id: string) => Promise<void>;
  stopServer: (id: string) => Promise<void>;
  refreshServers: () => Promise<void>;
  createServer: (config: MCPServerConfig) => Promise<void>;
  updateServerConfig: (id: string, config: Partial<MCPServerConfig>) => Promise<void>;
  deleteServer: (id: string) => Promise<void>;
}

export const useServerStore = create<ServerState>((set, get) => ({
  // Initial state
  servers: [],
  isLoading: false,
  isUpdating: [],
  error: null,
  searchQuery: '',
  expandedServerId: null,
  selectedServerId: null,

  // Basic state setters
  setServers: (servers) => set({ servers }),
  
  addServer: (server) => 
    set((state) => ({ 
      servers: [...state.servers, server] 
    })),
  
  updateServer: (id, updates) =>
    set((state) => ({
      servers: state.servers.map((server) =>
        server.id === id ? { ...server, ...updates } : server
      ),
    })),
  
  removeServer: (id) =>
    set((state) => ({
      servers: state.servers.filter((server) => server.id !== id),
    })),
  
  setServerStatus: (id, status) =>
    set((state) => ({
      servers: state.servers.map((server) =>
        server.id === id ? { ...server, status } : server
      ),
    })),
  
  
  setLoading: (isLoading) => set({ isLoading }),
  
  setUpdating: (serverId, updating) =>
    set((state) => ({
      isUpdating: updating
        ? [...state.isUpdating, serverId]
        : state.isUpdating.filter((id) => id !== serverId),
    })),
  
  setError: (error) => set({ error }),

  // UI actions
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  
  setExpandedServerId: (expandedServerId) => set({ expandedServerId }),
  
  setSelectedServerId: (selectedServerId) => set({ selectedServerId }),
  

  // Server operations with Electron API integration
  startServer: async (id) => {
    const { setUpdating, setError, setServerStatus } = get();
    
    try {
      setUpdating(id, true);
      setError(null);
      
      // Update status to starting immediately for UI feedback
      setServerStatus(id, 'starting');
      
      // Call Electron API
      await window.electronAPI.startMcpServer(id);
      
      // The actual status will be updated via server status polling
      // or through IPC events from the main process
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to start server');
      setServerStatus(id, 'error');
    } finally {
      setUpdating(id, false);
    }
  },

  stopServer: async (id) => {
    const { setUpdating, setError, setServerStatus } = get();
    
    try {
      setUpdating(id, true);
      setError(null);
      
      // Update status to stopping immediately for UI feedback
      setServerStatus(id, 'stopping');
      
      // Call Electron API
      await window.electronAPI.stopMcpServer(id);
      
      // The actual status will be updated via server status polling
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to stop server');
      setServerStatus(id, 'error');
    } finally {
      setUpdating(id, false);
    }
  },

  refreshServers: async () => {
    const { setLoading, setError, setServers } = get();
    
    try {
      setLoading(true);
      setError(null);
      
      const servers = await window.electronAPI.listMcpServers();
      setServers(servers);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to refresh servers');
    } finally {
      setLoading(false);
    }
  },


  createServer: async (config) => {
    const { setError, addServer } = get();
    
    try {
      setError(null);
      
      const newServer = await window.electronAPI.addMcpServer(config);
      addServer(newServer);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create server');
      throw error; // Re-throw to let the UI handle the error
    }
  },

  updateServerConfig: async (id, config) => {
    const { setUpdating, setError, updateServer } = get();
    
    try {
      setUpdating(id, true);
      setError(null);
      
      const updatedServer = await window.electronAPI.updateMcpServerConfig(id, config);
      updateServer(id, updatedServer);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update server');
      throw error; // Re-throw to let the UI handle the error
    } finally {
      setUpdating(id, false);
    }
  },

  deleteServer: async (id) => {
    const { setUpdating, setError, removeServer } = get();
    
    try {
      setUpdating(id, true);
      setError(null);
      
      await window.electronAPI.removeMcpServer(id);
      removeServer(id);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete server');
      throw error; // Re-throw to let the UI handle the error
    } finally {
      setUpdating(id, false);
    }
  },
}));

// Utility selectors
export const useServerById = (id: string) =>
  useServerStore((state) => state.servers.find((server) => server.id === id));

export const useServersByStatus = (status: MCPServer['status']) =>
  useServerStore((state) => state.servers.filter((server) => server.status === status));

export const useIsServerUpdating = (id: string) =>
  useServerStore((state) => state.isUpdating.includes(id));