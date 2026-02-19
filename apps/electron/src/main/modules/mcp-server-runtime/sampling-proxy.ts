import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CreateMessageRequest,
  CreateMessageResult,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { getRateLimiter, RateLimitResult } from "./rate-limiter";

/**
 * Proxies sampling/createMessage requests from backend MCP servers
 * to the upstream AI client connected via the aggregator server.
 *
 * MCP Router acts as a transparent proxy — it doesn't have its own LLM.
 * When a backend server sends a sampling request, this proxy forwards it
 * to whichever upstream client (Claude Desktop, Cursor, etc.) is currently
 * connected to the aggregator.
 *
 * TODO: Currently this uses a last-writer-wins pattern where only the most
 * recently connected client session can receive sampling requests. In a
 * multi-client scenario, we need a way to route sampling requests back to
 * the specific client that initiated the tool call.
 */
export class SamplingProxy {
  private activeServer: Server | null = null;

  /**
   * Set the active upstream server instance that can forward
   * sampling requests to its connected client.
   */
  setActiveServer(server: Server | null): void {
    this.activeServer = server;
  }

  /**
   * Forward a sampling/createMessage request to the upstream client.
   * Enforces rate limits and caps maxTokens to prevent abuse.
   * Throws if no upstream client is connected.
   */
  async createMessage(
    params: CreateMessageRequest["params"],
  ): Promise<CreateMessageResult> {
    if (!this.activeServer) {
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
    if (params.maxTokens > MAX_SAMPLING_TOKENS) {
      params.maxTokens = MAX_SAMPLING_TOKENS;
    }

    return await this.activeServer.createMessage(params);
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
