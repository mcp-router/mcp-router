/**
 * Agent management domain API (includes chat functionality)
 */

import { Agent, AgentConfig, DeployedAgent } from "@mcp_router/shared";
import { Unsubscribe } from "./auth-api";
import type { LocalChatMessage as ChatMessage } from "@mcp_router/shared";

interface CreateAgentInput extends Omit<AgentConfig, "id"> {}

interface UpdateAgentInput extends Partial<AgentConfig> {}

interface DeployTarget {
  platform: "cloud" | "local";
  config?: any;
}

interface DeploymentResult {
  success: boolean;
  deployedAgent?: DeployedAgent;
  error?: string;
}

interface Tool {
  name: string;
  description?: string;
  parameters?: any;
  enabled?: boolean;
  inputSchema?: any;
}

interface ToolResult {
  success: boolean;
  result?: any;
  error?: string;
}

interface ChatSession {
  id: string;
  agentId: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

interface SessionListOptions {
  offset?: number;
  limit?: number;
  cursor?: string;
}

interface SessionListResult {
  sessions: ChatSession[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface AgentAPI {
  // Agent management
  list(): Promise<Agent[]>;
  get(id: string): Promise<Agent | null>;
  create(input: CreateAgentInput): Promise<Agent>;
  update(id: string, updates: UpdateAgentInput): Promise<Agent>;
  delete(id: string): Promise<boolean>;
  share(id: string): Promise<string>;
  import(shareCode: string): Promise<DeployedAgent | undefined>;

  // Deployment
  deploy(id: string, target?: DeployTarget): Promise<DeploymentResult>;
  getDeployed(): Promise<DeployedAgent[]>;
  updateDeployed(id: string, config: any): Promise<DeployedAgent | undefined>;
  deleteDeployed(id: string): Promise<boolean>;

  // Tool management
  tools: {
    execute(agentId: string, toolName: string, args: any): Promise<ToolResult>;
    list(
      agentId: string,
      serverId: string,
      isDev?: boolean,
    ): Promise<{
      success: boolean;
      tools: Tool[];
      error?: string;
    }>;
  };

  // Session management
  sessions: {
    create(
      agentId: string,
      initialMessages?: ChatMessage[],
    ): Promise<ChatSession>;
    list(
      agentId: string,
      options?: SessionListOptions,
    ): Promise<SessionListResult>;
    delete(sessionId: string): Promise<boolean>;
    update(sessionId: string, messages: ChatMessage[]): Promise<ChatSession>;
  };

  // Streaming chat
  stream: {
    start(data: any): Promise<{ success: boolean; error?: string }>;
    send(data: any): Promise<{ success: boolean; error?: string }>;
    end(data: any): Promise<{ success: boolean; error?: string }>;
    error(data: any): Promise<{ success: boolean; error?: string }>;
    onStart(callback: (data: any) => void): Unsubscribe;
    onChunk(callback: (data: any) => void): Unsubscribe;
    onEnd(callback: (data: any) => void): Unsubscribe;
    onError(callback: (data: any) => void): Unsubscribe;
  };

  // Background chat
  background: {
    start(
      sessionId: string | undefined,
      agentId: string,
      query: string,
    ): Promise<{ success: boolean; error?: string }>;
    stop(agentId: string): Promise<{ success: boolean; error?: string }>;
    onStart(callback: (data: any) => void): Unsubscribe;
    onStop(callback: (data: any) => void): Unsubscribe;
  };
}
