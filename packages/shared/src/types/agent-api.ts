// Agent API types for the AgentChatPlayground component
// Note: For comprehensive chat types, see apps/electron/src/lib/types/chat-types.ts
export interface AgentChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// Request for /api/agent/use endpoint
export interface AgentUseRequest {
  message: string;
  agentId: string;
  history: AgentChatMessage[];
  sessionId?: string;
}

// Request for /api/agent/setup endpoint
export interface AgentSetupRequest {
  message: string;
  agentId: string;
  history: AgentChatMessage[];
  servers: any[]; // Using the MCPServerConfig type from your app
}
