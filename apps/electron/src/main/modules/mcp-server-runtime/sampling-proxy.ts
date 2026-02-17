import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type {
  CreateMessageRequest,
  CreateMessageResult,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * Proxies sampling/createMessage requests from backend MCP servers
 * to the upstream AI client connected via the aggregator server.
 *
 * MCP Router acts as a transparent proxy — it doesn't have its own LLM.
 * When a backend server sends a sampling request, this proxy forwards it
 * to whichever upstream client (Claude Desktop, Cursor, etc.) is currently
 * connected to the aggregator.
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
   * Throws if no upstream client is connected.
   */
  async createMessage(
    params: CreateMessageRequest["params"],
  ): Promise<CreateMessageResult> {
    if (!this.activeServer) {
      throw new Error(
        "No upstream client connected — cannot forward sampling request.",
      );
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
