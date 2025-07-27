/**
 * Centralized chat-related type definitions
 * This file consolidates all chat message types used across the application
 */

// Base chat message interface
export interface BaseChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// Tool-related types
export interface ToolCall {
  id: string;
  name: string;
  arguments?: any;
}

export interface ToolResult {
  toolCallId?: string;
  content: any;
  isError?: boolean;
  success?: boolean;
  result?: any;
  error?: string;
}

/**
 * Agent chat message type used for API communication
 * Used in: @mcp_router/shared/types/agent-api.ts
 */
export interface AgentChatMessage extends BaseChatMessage {
  // Inherits role and content from BaseChatMessage
}

/**
 * Local chat message type used in platform API
 * Used in: apps/electron/src/lib/platform-api/types/domains/agent-api.ts
 */
export interface LocalChatMessage extends BaseChatMessage {
  id?: string;
  timestamp?: Date;
  toolCalls?: ToolCall[];
  toolResults?: Array<{
    success: boolean;
    result?: any;
    error?: string;
  }>;
}

/**
 * Platform chat message type used for platform API communication
 * Used in: packages/shared/src/types/platform-api/index.ts
 */
export interface PlatformChatMessage extends BaseChatMessage {
  id: string;
  timestamp: number;
  toolCalls?: any[];
  toolResults?: ToolResult[];
}

/**
 * Extended platform chat message used in BackgroundComponent
 * Ensures all required properties for UI rendering
 */
export interface ExtendedPlatformChatMessage extends PlatformChatMessage {
  toolCalls?: any[];
  toolResults?: Array<{
    toolCallId?: string;
    content: any;
    isError: boolean;
  }>;
}

/**
 * Chat session interface
 */
export interface ChatSession {
  id: string;
  agentId: string;
  title?: string;
  messages: PlatformChatMessage[];
  createdAt: number | Date;
  updatedAt: number | Date;
  status?: "active" | "archived" | "deleted";
}

/**
 * Agent chat session (extended version)
 * Used in: packages/shared/src/types/platform-api/index.ts
 */
export interface AgentChatSession extends ChatSession {
  title: string;
  messages: PlatformChatMessage[];
  createdAt: number;
  updatedAt: number;
  status: "active" | "archived" | "deleted";
}


/**
 * Type guards
 */
export function isPlatformChatMessage(
  message: any,
): message is PlatformChatMessage {
  return (
    message &&
    typeof message.id === "string" &&
    typeof message.timestamp === "number" &&
    ["user", "assistant", "system"].includes(message.role) &&
    typeof message.content === "string"
  );
}

export function isLocalChatMessage(message: any): message is LocalChatMessage {
  return (
    message &&
    ["user", "assistant", "system"].includes(message.role) &&
    typeof message.content === "string" &&
    (message.timestamp === undefined || message.timestamp instanceof Date)
  );
}

export function isAgentChatMessage(message: any): message is AgentChatMessage {
  return (
    message &&
    ["user", "assistant", "system"].includes(message.role) &&
    typeof message.content === "string"
  );
}

/**
 * Conversion utilities
 */
export function convertToLocalChatMessage(
  msg: PlatformChatMessage,
): LocalChatMessage {
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: new Date(msg.timestamp),
    toolCalls: msg.toolCalls,
    toolResults: msg.toolResults?.map((tr) => ({
      success: !tr.isError,
      result: tr.content,
      error: tr.isError ? String(tr.content) : undefined,
    })),
  };
}

export function convertToPlatformChatMessage(
  msg: LocalChatMessage,
  id?: string,
): PlatformChatMessage {
  return {
    id: id || msg.id || generateMessageId(),
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp ? msg.timestamp.getTime() : Date.now(),
    toolCalls: msg.toolCalls,
    toolResults: msg.toolResults?.map((tr) => ({
      content: tr.result,
      isError: !tr.success,
      error: tr.error,
    })),
  };
}

export function convertAgentChatMessage(
  msg: AgentChatMessage,
  id?: string,
  timestamp?: number,
): PlatformChatMessage {
  return {
    id: id || generateMessageId(),
    role: msg.role,
    content: msg.content,
    timestamp: timestamp || Date.now(),
    toolCalls: [],
    toolResults: [],
  };
}

/**
 * Helper function to generate message IDs
 */
function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Re-export for convenience
 */
export type {
  AgentChatMessage as SimpleChatMessage, // Alias for backward compatibility
  PlatformChatMessage as ChatMessage, // Default ChatMessage type
};
