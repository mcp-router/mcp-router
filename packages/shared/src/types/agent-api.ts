// Agent API types for the AgentChatPlayground component
// Note: For comprehensive chat types, see apps/electron/src/lib/types/chat-types.ts
export interface AgentChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}
