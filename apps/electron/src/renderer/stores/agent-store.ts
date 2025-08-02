import { create, StoreApi, UseBoundStore } from "zustand";
import {
  AgentConfig,
  DeployedAgent,
  AgentState,
  AgentStoreChatSession,
  PlatformAPI,
} from "@mcp_router/shared";
import type { AgentChatMessage } from "@mcp_router/shared";
import { Message } from "@ai-sdk/react";

export interface AgentStoreInterface extends AgentState {
  // Actions for development agents
  setDevelopmentAgents: (agents: AgentConfig[]) => void;
  addDevelopmentAgent: (agent: AgentConfig) => void;
  updateDevelopmentAgent: (id: string, updates: Partial<AgentConfig>) => void;
  removeDevelopmentAgent: (id: string) => void;
  setCurrentDevelopmentAgent: (agent: AgentConfig | null) => void;

  // Actions for deployed agents
  setDeployedAgents: (agents: DeployedAgent[]) => void;
  addDeployedAgent: (agent: DeployedAgent) => void;
  updateDeployedAgent: (id: string, updates: Partial<DeployedAgent>) => void;
  removeDeployedAgent: (id: string) => void;
  setCurrentDeployedAgent: (agent: DeployedAgent | null) => void;

  // Actions for chat sessions
  setChatSessions: (sessions: AgentStoreChatSession[]) => void;
  addChatSession: (session: AgentStoreChatSession) => void;
  updateChatSession: (
    id: string,
    updates: Partial<AgentStoreChatSession>,
  ) => void;
  removeChatSession: (id: string) => void;
  setCurrentSessionId: (sessionId: string | null) => void;
  addMessageToSession: (sessionId: string, message: AgentChatMessage) => void;
  resetSessions: () => void;

  // Actions for chat messages
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  removeMessage: (messageId: string) => void;
  resetMessages: () => void;
  setCurrentStreamMessage: (message: Message | null) => void;
  setIsStreaming: (streaming: boolean) => void;
  resetChatState: (agentId: string, instructions?: string) => void;

  // Loading actions
  setLoading: (loading: boolean) => void;
  setLoadingSessions: (loading: boolean) => void;
  setLoadingMoreSessions: (loading: boolean) => void;
  setProcessingMessage: (processing: boolean) => void;
  setDeletingSession: (sessionId: string, deleting: boolean) => void;

  // Error actions
  setError: (error: string | null) => void;
  setChatError: (error: string | null) => void;
  setSessionsError: (error: string | null) => void;

  // Auth actions
  setAuthToken: (token: string | null) => void;
  fetchAuthToken: () => Promise<void>;

  // Operations
  createDevelopmentAgent: (
    config: Omit<AgentConfig, "id" | "createdAt" | "updatedAt">,
  ) => Promise<AgentConfig>;
  updateDevelopmentAgentConfig: (
    id: string,
    config: Partial<AgentConfig>,
  ) => Promise<void>;
  deleteDevelopmentAgent: (id: string) => Promise<void>;

  deployAgent: (agentId: string) => Promise<DeployedAgent>;
  undeployAgent: (agentId: string) => Promise<void>;

  fetchChatSessions: (
    agentId: string,
    cursor?: string,
    append?: boolean,
  ) => Promise<void>;
  loadMoreSessions: () => void;
  deleteChatSession: (sessionId: string) => Promise<void>;

  sendMessage: (message: string, sessionId?: string) => Promise<void>;

  refreshAgents: () => Promise<void>;

  // Store management
  clearStore: () => void;
}

export const createAgentStore = (
  getPlatformAPI: () => PlatformAPI,
): UseBoundStore<StoreApi<AgentStoreInterface>> =>
  create<AgentStoreInterface>((set, get) => ({
    // Initial state
    developmentAgents: [],
    currentDevelopmentAgent: null,
    deployedAgents: [],
    currentDeployedAgent: null,
    chatSessions: [],
    currentSessionId: null,
    hasMoreSessions: true,
    nextCursor: undefined,
    messages: [],
    currentStreamMessage: null,
    isStreaming: false,
    isLoading: false,
    isLoadingSessions: false,
    isLoadingMoreSessions: false,
    isProcessingMessage: false,
    deletingSessions: new Set<string>(),
    error: null,
    chatError: null,
    sessionsError: null,
    authToken: null,

    // Development agent actions
    setDevelopmentAgents: (developmentAgents) => set({ developmentAgents }),

    addDevelopmentAgent: (agent) =>
      set((state) => ({
        developmentAgents: [...state.developmentAgents, agent],
      })),

    updateDevelopmentAgent: (id, updates) =>
      set((state) => ({
        developmentAgents: state.developmentAgents.map((agent) =>
          agent.id === id ? { ...agent, ...updates } : agent,
        ),
        currentDevelopmentAgent:
          state.currentDevelopmentAgent?.id === id
            ? { ...state.currentDevelopmentAgent, ...updates }
            : state.currentDevelopmentAgent,
      })),

    removeDevelopmentAgent: (id) =>
      set((state) => ({
        developmentAgents: state.developmentAgents.filter(
          (agent) => agent.id !== id,
        ),
        currentDevelopmentAgent:
          state.currentDevelopmentAgent?.id === id
            ? null
            : state.currentDevelopmentAgent,
      })),

    setCurrentDevelopmentAgent: (currentDevelopmentAgent) =>
      set({ currentDevelopmentAgent }),

    // Deployed agent actions
    setDeployedAgents: (deployedAgents) => set({ deployedAgents }),

    addDeployedAgent: (agent) =>
      set((state) => ({
        deployedAgents: [...state.deployedAgents, agent],
      })),

    updateDeployedAgent: (id, updates) =>
      set((state) => ({
        deployedAgents: state.deployedAgents.map((agent) =>
          agent.id === id ? { ...agent, ...updates } : agent,
        ),
        currentDeployedAgent:
          state.currentDeployedAgent?.id === id
            ? { ...state.currentDeployedAgent, ...updates }
            : state.currentDeployedAgent,
      })),

    removeDeployedAgent: (id) =>
      set((state) => ({
        deployedAgents: state.deployedAgents.filter((agent) => agent.id !== id),
        currentDeployedAgent:
          state.currentDeployedAgent?.id === id
            ? null
            : state.currentDeployedAgent,
      })),

    setCurrentDeployedAgent: (currentDeployedAgent) =>
      set({ currentDeployedAgent }),

    // Chat session actions
    setChatSessions: (chatSessions) => set({ chatSessions }),

    addChatSession: (session) =>
      set((state) => ({
        chatSessions: [...state.chatSessions, session],
      })),

    updateChatSession: (id, updates) =>
      set((state) => ({
        chatSessions: state.chatSessions.map((session) =>
          session.id === id ? { ...session, ...updates } : session,
        ),
      })),

    removeChatSession: (id) =>
      set((state) => ({
        chatSessions: state.chatSessions.filter((session) => session.id !== id),
        currentSessionId:
          state.currentSessionId === id ? null : state.currentSessionId,
      })),

    setCurrentSessionId: (currentSessionId) => set({ currentSessionId }),

    addMessageToSession: (sessionId, message) =>
      set((state) => ({
        chatSessions: state.chatSessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                messages: [...(session.messages || []), message],
                updatedAt: Date.now(),
              }
            : session,
        ),
      })),

    resetSessions: () =>
      set({
        chatSessions: [],
        currentSessionId: null,
        hasMoreSessions: true,
        nextCursor: undefined,
        sessionsError: null,
      }),

    // Chat message actions
    setMessages: (messages) => set({ messages }),

    addMessage: (message) =>
      set((state) => ({
        messages: [...state.messages, message],
      })),

    updateMessage: (messageId, updates) =>
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === messageId ? { ...msg, ...updates } : msg,
        ),
      })),

    removeMessage: (messageId) =>
      set((state) => ({
        messages: state.messages.filter((msg) => msg.id !== messageId),
      })),

    resetMessages: () => set({ messages: [] }),

    setCurrentStreamMessage: (currentStreamMessage) =>
      set({ currentStreamMessage }),

    setIsStreaming: (isStreaming) => set({ isStreaming }),

    resetChatState: (_agentId, instructions = "") =>
      set({
        messages: [
          {
            id: "system-1",
            role: "system",
            content: instructions,
            parts: [{ type: "text" as const, text: instructions }],
          },
        ],
        currentStreamMessage: null,
        isStreaming: false,
        chatError: null,
      }),

    // Loading actions
    setLoading: (isLoading) => set({ isLoading }),
    setLoadingSessions: (isLoadingSessions) => set({ isLoadingSessions }),
    setLoadingMoreSessions: (isLoadingMoreSessions) =>
      set({ isLoadingMoreSessions }),
    setProcessingMessage: (isProcessingMessage) => set({ isProcessingMessage }),
    setDeletingSession: (sessionId, deleting) =>
      set((state) => {
        const newDeletingSessions = new Set(state.deletingSessions);
        if (deleting) {
          newDeletingSessions.add(sessionId);
        } else {
          newDeletingSessions.delete(sessionId);
        }
        return { deletingSessions: newDeletingSessions };
      }),

    // Error actions
    setError: (error) => set({ error }),
    setChatError: (chatError) => set({ chatError }),
    setSessionsError: (sessionsError) => set({ sessionsError }),

    // Auth actions
    setAuthToken: (authToken) => set({ authToken }),

    fetchAuthToken: async () => {
      const { setAuthToken } = get();
      try {
        const status = await getPlatformAPI().auth.getStatus();
        if (status.authenticated && status.token) {
          setAuthToken(status.token);
        } else {
          setAuthToken(null);
        }
      } catch (error) {
        console.error("Error fetching authentication token:", error);
        setAuthToken(null);
      }
    },

    // Operations
    createDevelopmentAgent: async (config) => {
      const { setError, addDevelopmentAgent } = get();

      try {
        setError(null);

        const newAgent = await getPlatformAPI().agents.create(config);
        addDevelopmentAgent(newAgent);
        return newAgent;
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Failed to create agent",
        );
        throw error;
      }
    },

    updateDevelopmentAgentConfig: async (id, config) => {
      const { setError, updateDevelopmentAgent } = get();

      try {
        setError(null);

        const updatedAgent = await getPlatformAPI().agents.update(id, config);
        updateDevelopmentAgent(id, updatedAgent);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Failed to update agent",
        );
        throw error;
      }
    },

    deleteDevelopmentAgent: async (id) => {
      const { setError, removeDevelopmentAgent } = get();

      try {
        setError(null);

        const success = await getPlatformAPI().agents.delete(id);
        if (success) {
          removeDevelopmentAgent(id);
        } else {
          throw new Error("Failed to delete agent");
        }
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Failed to delete agent",
        );
        throw error;
      }
    },

    deployAgent: async (agentId) => {
      const { setError, addDeployedAgent } = get();

      try {
        setError(null);

        const result = await getPlatformAPI().agents.deploy(agentId);
        if (!result.success || !result.deployedAgent) {
          throw new Error(result.error || "Failed to deploy agent");
        }
        addDeployedAgent(result.deployedAgent);
        return result.deployedAgent;
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Failed to deploy agent",
        );
        throw error;
      }
    },

    undeployAgent: async (agentId) => {
      const { setError, removeDeployedAgent } = get();

      try {
        setError(null);

        const success = await getPlatformAPI().agents.deleteDeployed(agentId);
        if (success) {
          removeDeployedAgent(agentId);
        } else {
          throw new Error("Failed to undeploy agent");
        }
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Failed to undeploy agent",
        );
        throw error;
      }
    },

    fetchChatSessions: async (agentId, cursor, append = false) => {
      const {
        setLoadingSessions,
        setLoadingMoreSessions,
        setSessionsError,
        chatSessions,
      } = get();

      if (!append) {
        setLoadingSessions(true);
        setSessionsError(null);
      } else {
        setLoadingMoreSessions(true);
      }

      try {
        const options = {
          limit: 5,
          cursor,
          orderBy: "updated_at" as const,
          order: "DESC" as const,
        };

        const data = await getPlatformAPI().agents.sessions.list(
          agentId,
          options,
        );

        // Convert ChatSession to AgentStoreChatSession
        const convertedSessions = (data.sessions || []).map((session) => ({
          id: session.id,
          agentId: session.agentId,
          lastMessage:
            session.messages && session.messages.length > 0
              ? session.messages[session.messages.length - 1].content
              : undefined,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          messages: session.messages,
        }));

        if (append) {
          set({
            chatSessions: [...chatSessions, ...convertedSessions],
            hasMoreSessions: data.hasMore || false,
            nextCursor: data.nextCursor,
          });
        } else {
          set({
            chatSessions: convertedSessions,
            hasMoreSessions: data.hasMore || false,
            nextCursor: data.nextCursor,
          });
        }
      } catch (error) {
        setSessionsError(
          error instanceof Error ? error.message : "Failed to load sessions",
        );
      } finally {
        setLoadingSessions(false);
        setLoadingMoreSessions(false);
      }
    },

    loadMoreSessions: () => {
      const {
        hasMoreSessions,
        nextCursor,
        isLoadingMoreSessions,
        currentDeployedAgent,
        fetchChatSessions,
      } = get();

      if (
        hasMoreSessions &&
        nextCursor &&
        !isLoadingMoreSessions &&
        currentDeployedAgent
      ) {
        fetchChatSessions(currentDeployedAgent.id, nextCursor, true);
      }
    },

    deleteChatSession: async (sessionId) => {
      const {
        setSessionsError,
        removeChatSession,
        currentSessionId,
        setCurrentSessionId,
        deletingSessions,
        setDeletingSession,
      } = get();

      // Check if already deleting this session
      if (deletingSessions.has(sessionId)) {
        console.log("Session already being deleted:", sessionId);
        return;
      }

      try {
        setSessionsError(null);
        setDeletingSession(sessionId, true);

        const success =
          await getPlatformAPI().agents.sessions.delete(sessionId);

        if (!success) {
          throw new Error("Failed to delete session");
        }

        // Remove from local state
        removeChatSession(sessionId);

        // If the deleted session was current, reset to null
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null);
        }
      } catch (error) {
        setSessionsError(
          error instanceof Error ? error.message : "Failed to delete session",
        );
        throw error;
      } finally {
        setDeletingSession(sessionId, false);
      }
    },

    sendMessage: async (message, sessionId) => {
      const {
        setProcessingMessage,
        setChatError,
        addMessageToSession,
        currentSessionId,
        currentDevelopmentAgent,
        currentDeployedAgent,
      } = get();

      const targetSessionId = sessionId || currentSessionId;
      const currentAgent = currentDevelopmentAgent || currentDeployedAgent;

      if (!targetSessionId || !currentAgent) {
        setChatError("No active session or agent");
        return;
      }

      try {
        setProcessingMessage(true);
        setChatError(null);

        // Add user message immediately
        const userMessage: AgentChatMessage = {
          role: "user",
          content: message,
        };
        addMessageToSession(targetSessionId, userMessage);

        // Send message to agent using background chat
        const result = await getPlatformAPI().agents.background.start(
          targetSessionId,
          currentAgent.id,
          message,
        );
        if (!result.success) {
          throw new Error(result.error || "Failed to start chat");
        }
      } catch (error) {
        setChatError(
          error instanceof Error ? error.message : "Failed to send message",
        );
        throw error;
      } finally {
        setProcessingMessage(false);
      }
    },

    refreshAgents: async () => {
      const { setLoading, setError, setDevelopmentAgents, setDeployedAgents } =
        get();

      try {
        setLoading(true);
        setError(null);

        const [developmentAgents, deployedAgents] = await Promise.all([
          getPlatformAPI().agents.list(),
          getPlatformAPI().agents.getDeployed(),
        ]);

        setDevelopmentAgents(developmentAgents);
        setDeployedAgents(deployedAgents || []);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Failed to refresh agents",
        );
      } finally {
        setLoading(false);
      }
    },

    clearStore: () => {
      set({
        developmentAgents: [],
        currentDevelopmentAgent: null,
        deployedAgents: [],
        currentDeployedAgent: null,
        chatSessions: [],
        currentSessionId: null,
        hasMoreSessions: true,
        nextCursor: undefined,
        messages: [],
        currentStreamMessage: null,
        isStreaming: false,
        isLoading: false,
        isLoadingSessions: false,
        isLoadingMoreSessions: false,
        isProcessingMessage: false,
        deletingSessions: new Set<string>(),
        error: null,
        chatError: null,
        sessionsError: null,
        authToken: null,
      });
    },
  }));

// Utility selector creators
export const createAgentSelectors = <
  T extends ReturnType<typeof createAgentStore>,
>(
  useStore: T,
) => ({
  useCurrentAgent: () =>
    useStore(
      (state) => state.currentDevelopmentAgent || state.currentDeployedAgent,
    ),

  useCurrentSession: () =>
    useStore((state) =>
      state.currentSessionId
        ? state.chatSessions.find((s) => s.id === state.currentSessionId)
        : null,
    ),

  useSessionsByAgent: (agentId: string) =>
    useStore((state) =>
      state.chatSessions.filter((session) => session.agentId === agentId),
    ),
});
