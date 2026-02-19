import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CreateMessageRequest,
  CreateMessageResult,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { getRateLimiter, RateLimitResult } from "./rate-limiter";
import { getCurrentSessionId } from "./request-context";

/**
 * Proxies sampling/createMessage requests from backend MCP servers
 * to the upstream AI client connected via the aggregator server.
 *
 * MCP Router acts as a transparent proxy — it doesn't have its own LLM.
 * When a backend server sends a sampling request, this proxy forwards it
 * to whichever upstream client (Claude Desktop, Cursor, etc.) is currently
 * connected to the aggregator.
 *
 * Session-aware routing:
 *  - Primary path: route by the current request's session ID.
 *  - Fallback path: activeServer (for non-session or legacy flows).
 *
 * Remaining limitation: non-session flows still use fallback behavior.
 */
export class SamplingProxy {
  private activeServer: Server | null = null;
  private readonly sessionServers: Map<string, Server> = new Map();

  /**
   * Set the active upstream server instance that can forward
   * sampling requests to its connected client.
   */
  setActiveServer(server: Server | null): void {
    this.activeServer = server;
  }

  /**
   * Register the upstream server associated with a specific client session.
   */
  registerSessionServer(sessionId: string, server: Server): void {
    this.sessionServers.set(sessionId, server);
  }

  /**
   * Remove a session-specific server association.
   */
  unregisterSessionServer(sessionId: string): void {
    this.sessionServers.delete(sessionId);
  }

  /**
   * Forward a sampling/createMessage request to the upstream client.
   * Enforces rate limits and caps maxTokens to prevent abuse.
   * Throws if no upstream client is connected.
   */
  async createMessage(
    params: CreateMessageRequest["params"],
  ): Promise<CreateMessageResult> {
    const sessionId = getCurrentSessionId();
    const sessionServer = sessionId
      ? this.sessionServers.get(sessionId)
      : undefined;
    const targetServer = sessionServer ?? this.activeServer;

    if (!targetServer) {
      throw new McpError(
        ErrorCode.InternalError,
        "No upstream client connected — cannot forward sampling request.",
      );
    }

    // Rate limit sampling requests globally for now
    // In the future this should be per backend server
    const result: RateLimitResult =
      getRateLimiter().tryConsume("sampling_proxy");
    if (!result.allowed) {
      const retryAfterSec = Math.ceil((result.retryAfterMs ?? 1000) / 1000);
      const RATE_LIMIT_ERROR_CODE = -32000 as ErrorCode;
      throw new McpError(
        RATE_LIMIT_ERROR_CODE,
        `Sampling rate limit exceeded. Retry after ${retryAfterSec}s.`,
      );
    }

    // Hard cap maxTokens to prevent malicious servers from draining user's LLM budget
    const MAX_SAMPLING_TOKENS = 4096;
    const safeParams = {
      ...params,
      maxTokens: Math.min(params.maxTokens, MAX_SAMPLING_TOKENS),
    };

    return await targetServer.createMessage(safeParams);
  }
}

let instance: SamplingProxy | null = null;

export function getSamplingProxy(): SamplingProxy {
  if (!instance) {
    instance = new SamplingProxy();
  }
  return instance;
}

export function resetSamplingProxy(): void {
  instance = null;
}
