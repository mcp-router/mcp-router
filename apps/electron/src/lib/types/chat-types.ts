/**
 * Centralized chat-related type definitions
 * This file consolidates all chat message types used across the application
 */

// Base chat message interface
interface BaseChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// Tool-related types
interface ToolCall {
  id: string;
  name: string;
  arguments?: any;
}

interface ToolResult {
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
interface PlatformChatMessage extends BaseChatMessage {
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

