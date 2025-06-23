import { create, StoreApi, UseBoundStore } from "zustand";
import { AgentConfig, DeployedAgent } from "@mcp-router/shared";
import { AgentChatMessage } from "@mcp-router/shared";
import { Message } from "@ai-sdk/react";
import { PlatformAPI } from "@mcp-router/platform-api";

interface ChatSession {
  id: string;
  agentId: string;
  lastMessage?: string;
  createdAt: number;
  updatedAt?: number;
  messages?: any[]; // Messages from @ai-sdk/react (stored locally in database)
}

interface AgentState {
  // Development agents
  developmentAgents: AgentConfig[];
  currentDevelopmentAgent: AgentConfig | null;

  // Deployed agents
  deployedAgents: DeployedAgent[];
  currentDeployedAgent: DeployedAgent | null;

  // Chat sessions
  chatSessions: ChatSession[];
  currentSessionId: string | null;
  hasMoreSessions: boolean;
  nextCursor: string | undefined;

  // Chat messages for current session
  messages: Message[];
  currentStreamMessage: Message | null;
  isStreaming: boolean;

  // Loading states
  isLoading: boolean;
  isLoadingSessions: boolean;
  isLoadingMoreSessions: boolean;
  isProcessingMessage: boolean;
  deletingSessions: Set<string>;

  // Error states
  error: string | null;
  chatError: string | null;
  sessionsError: string | null;

  // Auth state for chat operations
  authToken: string | null;

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
  setChatSessions: (sessions: ChatSession[]) => void;
  addChatSession: (session: ChatSession) => void;
  updateChatSession: (id: string, updates: Partial<ChatSession>) => void;
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
  fetchSessionMessages: (sessionId: string) => Promise<any[]>;

  sendMessage: (message: string, sessionId?: string) => Promise<void>;

  refreshAgents: () => Promise<void>;
}

export const createAgentStore = (
  platformAPI: PlatformAPI,
): UseBoundStore<StoreApi<AgentState>> =>
  create<AgentState>((set, get) => ({
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
        const status = await platformAPI.getAuthStatus();
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

        const newAgent = await platformAPI.createAgent(config);
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

        await platformAPI.updateAgent(id, config);
        updateDevelopmentAgent(id, config);
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

        await platformAPI.deleteAgent(id);
        removeDevelopmentAgent(id);
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

        const deployedAgent = await platformAPI.deployAgent(agentId);
        if (!deployedAgent) {
          throw new Error("Failed to deploy agent");
        }
        addDeployedAgent(deployedAgent);
        return deployedAgent;
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

        await platformAPI.deleteDeployedAgent(agentId);
        removeDeployedAgent(agentId);
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

        const data = await platformAPI.getSessions(agentId, options);

        if (append) {
          set({
            chatSessions: [...chatSessions, ...(data.sessions || [])],
            hasMoreSessions: data.hasMore || false,
            nextCursor: data.nextCursor,
          });
        } else {
          set({
            chatSessions: data.sessions || [],
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

        const success = await platformAPI.deleteSession(sessionId);

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

    fetchSessionMessages: async (sessionId) => {
      const { setSessionsError } = get();

      try {
        setSessionsError(null);

        const messages = await platformAPI.fetchSessionMessages(sessionId);

        // Update the session with the fetched messages
        set((state) => ({
          chatSessions: state.chatSessions.map((session) =>
            session.id === sessionId ? { ...session, messages } : session,
          ),
        }));

        return messages;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to load session messages";
        setSessionsError(errorMessage);
        throw new Error(errorMessage);
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
        await platformAPI.startBackgroundChat(
          targetSessionId,
          currentAgent.id,
          message,
        );
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
          platformAPI.listAgents(),
          platformAPI.getDeployedAgents() || Promise.resolve([]),
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
