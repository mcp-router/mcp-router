import { safeConsoleLog, safeConsoleError } from "@/main/utils/safe-console";
import crypto from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { RequestHandlers } from "./request-handlers";
import { MCPServerManager } from "../mcp-server-manager/mcp-server-manager";
import { getLogService } from "@/main/modules/mcp-logger/mcp-logger.service";
import type { ToolCatalogService } from "@/main/modules/tool-catalog/tool-catalog.service";
import { getSamplingProxy } from "./sampling-proxy";

/** Tracked state for a single Streamable HTTP session. */
interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  server: Server;
  createdAt: number;
  lastActivityAt: number;
}

/** Default session time-to-live: 30 minutes (in milliseconds). */
const DEFAULT_SESSION_TTL_MS = 30 * 60 * 1000;

/** How often the cleanup timer runs: every 5 minutes. */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * MCP Aggregator Server that combines multiple MCP servers into one.
 *
 * Supports stateful Streamable HTTP sessions via MCP-Session-Id headers.
 * Each session gets its own Server + StreamableHTTPServerTransport pair.
 * Sessions are tracked in an in-memory map and expire after a configurable TTL.
 * Requests without an existing session ID trigger a new session (initialization).
 */
export class AggregatorServer {
  private requestHandlers: RequestHandlers;

  /** Active sessions keyed by MCP session ID. */
  private sessions: Map<string, SessionEntry> = new Map();

  /** Configurable session TTL in milliseconds. */
  private sessionTtlMs: number;

  /** Periodic timer for cleaning up expired sessions. */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    serverManager: MCPServerManager,
    toolCatalogService?: ToolCatalogService,
    sessionTtlMs: number = DEFAULT_SESSION_TTL_MS,
  ) {
    this.requestHandlers = new RequestHandlers(
      serverManager,
      toolCatalogService,
    );
    this.sessionTtlMs = sessionTtlMs;
    this.startCleanupTimer();
  }

  /**
   * Create a new stateful Server + StreamableHTTPServerTransport.
   *
   * The transport generates a UUID v4 session ID on initialization. Once the
   * SDK fires `onsessioninitialized`, the session is registered in the internal
   * map so subsequent requests carrying the same `Mcp-Session-Id` header can
   * be routed to this transport.
   */
  public async createSessionTransport(): Promise<StreamableHTTPServerTransport> {
    const server = this.createConfiguredServer();

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (sessionId: string) => {
        this.sessions.set(sessionId, {
          transport,
          server,
          createdAt: Date.now(),
          lastActivityAt: Date.now(),
        });
        safeConsoleLog(
          `[MCP Session] Initialized: ${sessionId} (active: ${this.sessions.size})`,
        );
      },
      onsessionclosed: (sessionId: string) => {
        this.sessions.delete(sessionId);
        safeConsoleLog(
          `[MCP Session] Closed: ${sessionId} (active: ${this.sessions.size})`,
        );
      },
    });

    transport.onclose = () => {
      const sessionId = transport.sessionId;
      if (sessionId) {
        this.sessions.delete(sessionId);
      }
    };

    await server.connect(transport);
    return transport;
  }

  /**
   * Look up an existing session transport by its MCP session ID.
   * Returns `undefined` if the session does not exist or has expired.
   */
  public getSessionTransport(
    sessionId: string,
  ): StreamableHTTPServerTransport | undefined {
    const entry = this.sessions.get(sessionId);
    if (!entry) return undefined;

    const now = Date.now();
    // Check TTL -- if expired, tear down and remove.
    if (now - entry.lastActivityAt > this.sessionTtlMs) {
      this.removeSession(sessionId, entry);
      return undefined;
    }

    // Update last activity timestamp on access
    entry.lastActivityAt = now;

    return entry.transport;
  }

  /** Number of active sessions (useful for diagnostics). */
  public get activeSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Create a fresh Server instance for SSE connections.
   * Each SSE client gets its own Server instance since the SDK
   * only allows one transport per Server.
   */
  public createSseServer(): Server {
    return this.createConfiguredServer();
  }

  /**
   * Create a Server instance with standard capabilities, handlers, and error logging.
   */
  private createConfiguredServer(): Server {
    const server = new Server(
      {
        name: "mcp-aggregator",
        version: "1.0.0",
      },
      {
        capabilities: {
          resources: {},
          tools: {},
          prompts: {},
          experimental: {
            elicitation: {
              form: {},
              url: {},
            },
          },
        },
      },
    );

    this.setupRequestHandlers(server);

    // Track the most recently created server so the SamplingProxy can
    // forward sampling/createMessage requests to the upstream client.
    getSamplingProxy().setActiveServer(server);

    server.onerror = (error) => {
      safeConsoleError("[MCP Aggregator Error]", error);
      getLogService().recordMcpRequestLog({
        timestamp: new Date().toISOString(),
        requestType: "ServerError",
        params: {},
        result: "error",
        errorMessage: error.message || "Unknown server error",
        duration: 0,
        clientId: "mcp-router-system",
      });
    };

    return server;
  }

  /**
   * Set up request handlers on a Server instance
   */
  private setupRequestHandlers(server: Server): void {
    // List Tools
    server.setRequestHandler(ListToolsRequestSchema, async (request) => {
      const token = request.params?._meta?.token as string | undefined;
      const projectId = request.params?._meta?.projectId;
      return await this.requestHandlers.handleListTools(token, projectId);
    });

    // Call Tool
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      return await this.requestHandlers.handleCallTool(request);
    });

    // List Resources
    server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
      const token = request.params?._meta?.token as string | undefined;
      const projectId = request.params?._meta?.projectId;
      return await this.requestHandlers.handleListResources(token, projectId);
    });

    // List Resource Templates
    server.setRequestHandler(
      ListResourceTemplatesRequestSchema,
      async (request) => {
        const token = request.params?._meta?.token as string | undefined;
        const projectId = request.params?._meta?.projectId;
        return await this.requestHandlers.handleListResourceTemplates(
          token,
          projectId,
        );
      },
    );

    // Read Resource
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;
      const token = request.params?._meta?.token as string | undefined;
      const projectId = request.params?._meta?.projectId;
      return await this.requestHandlers.readResourceByUri(
        uri,
        token,
        projectId,
      );
    });

    // List Prompts
    server.setRequestHandler(ListPromptsRequestSchema, async (request) => {
      const token = request.params?._meta?.token as string | undefined;
      const projectId = request.params?._meta?.projectId;
      const allPrompts = await this.requestHandlers.getAllPromptsInternal(
        token,
        projectId,
      );
      return { prompts: allPrompts };
    });

    // Get Prompt
    server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const promptName = request.params.name;
      const token = request.params?._meta?.token as string | undefined;
      const projectId = request.params?._meta?.projectId;
      return await this.requestHandlers.getPromptByName(
        promptName,
        request.params.arguments,
        token,
        projectId,
      );
    });
  }

  // ---------------------------------------------------------------------------
  // Session lifecycle helpers
  // ---------------------------------------------------------------------------

  /** Remove a session and close its transport. */
  private removeSession(sessionId: string, entry: SessionEntry): void {
    this.sessions.delete(sessionId);
    entry.transport.close().catch((err) => {
      safeConsoleError(
        `[MCP Session] Error closing transport ${sessionId}:`,
        err,
      );
    });
    safeConsoleLog(
      `[MCP Session] Removed (expired): ${sessionId} (active: ${this.sessions.size})`,
    );
  }

  /** Sweep expired sessions. Called periodically by the cleanup timer. */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, entry] of this.sessions) {
      if (now - entry.lastActivityAt > this.sessionTtlMs) {
        this.removeSession(sessionId, entry);
      }
    }
  }

  /** Start the periodic cleanup timer. */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions();
    }, CLEANUP_INTERVAL_MS);
    // Allow the Node process to exit even if the timer is still running.
    if (
      this.cleanupTimer &&
      typeof this.cleanupTimer === "object" &&
      "unref" in this.cleanupTimer
    ) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Clean up all sessions and stop the cleanup timer.
   */
  public async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    const closePromises: Promise<void>[] = [];
    for (const [sessionId, entry] of this.sessions) {
      safeConsoleLog(`[MCP Session] Shutting down session: ${sessionId}`);
      closePromises.push(
        entry.transport.close().catch((err) => {
          safeConsoleError(
            `[MCP Session] Error closing transport ${sessionId} during shutdown:`,
            err,
          );
        }),
      );
    }
    this.sessions.clear();
    await Promise.all(closePromises);
  }
}
