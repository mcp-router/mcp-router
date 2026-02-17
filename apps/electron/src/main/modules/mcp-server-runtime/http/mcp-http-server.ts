import express from "express";
import cors from "cors";
import * as http from "http";
import { MCPServerManager } from "../../mcp-server-manager/mcp-server-manager";
import { AggregatorServer } from "../aggregator-server";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse";
import { getPlatformAPIManager } from "../../workspace/platform-api-manager";
import { TokenValidator } from "../token-validator";
import { ProjectRepository } from "../../projects/projects.repository";
import { PROJECT_HEADER, UNASSIGNED_PROJECT_ID } from "@mcp_router/shared";
import { createApiRouter } from "./api-router";

/**
 * HTTP server that exposes MCP functionality through REST endpoints
 */
export class MCPHttpServer {
  private app: express.Application;
  private server: http.Server | null = null;
  private port: number;
  private serverManager: MCPServerManager;
  private aggregatorServer: AggregatorServer;
  private tokenValidator: TokenValidator;
  // Map for SSE sessions
  private sseSessions: Map<string, SSEServerTransport> = new Map();
  private sseSessionProjects: Map<string, string | null> = new Map();

  constructor(
    serverManager: MCPServerManager,
    port: number,
    aggregatorServer?: AggregatorServer,
  ) {
    this.serverManager = serverManager;
    this.aggregatorServer =
      aggregatorServer || new AggregatorServer(serverManager);
    this.port = port;
    this.app = express();
    // TokenValidator requires a server name-to-ID mapping
    this.tokenValidator = new TokenValidator(new Map());
    this.configureMiddleware();
    this.configureRoutes();
  }

  /**
   * Configure Express middleware
   */
  private configureMiddleware(): void {
    // Parse JSON request bodies
    this.app.use(express.json());

    // Enable CORS with restricted origins
    this.app.use(cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (same-origin, curl, MCP clients)
        if (!origin) return callback(null, true);
        // Allow localhost origins
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          return callback(null, true);
        }
        callback(new Error('Not allowed by CORS'));
      },
    }));

    // Create authentication middleware
    const authMiddleware = (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      const token = req.headers["authorization"];
      // Bearers token format
      if (token && token.startsWith("Bearer ")) {
        // Remove 'Bearer ' prefix
        req.headers["authorization"] = token.substring(7);
      }

      // Log the request without sensitive token information
      // console.log(`[HTTP] ${req.method} ${req.url}${clientName ? ` (Client: ${clientName})` : ''}, Body = ${JSON.stringify(req.body)}`);
      // Token validation middleware
      if (!token) {
        // No token provided
        res.status(401).json({
          error: "Authentication required. Please provide a valid token.",
        });
        return;
      }

      // Validate the token
      const tokenId =
        typeof token === "string"
          ? token.startsWith("Bearer ")
            ? token.substring(7)
            : token
          : "";
      const validation = this.tokenValidator.validateToken(tokenId);

      if (!validation.isValid) {
        // Invalid token
        res.status(401).json({
          error: validation.error || "Invalid token. Authentication failed.",
        });
        return;
      }

      // Token is valid and has proper scope, proceed to the next middleware or route handler
      next();
    };

    // Set /mcp endpoint as a direct route, exposed without versioning
    this.app.use("/mcp", authMiddleware);

    // Set /mcp/sse endpoint as a direct route, exposed without versioning
    this.app.use("/mcp/sse", authMiddleware);

    // /api routes need authentication
    this.app.use("/api", authMiddleware);
  }

  /**
   * Configure API routes
   */
  private configureRoutes(): void {
    this.configureMcpRoute();
    this.configureMcpSseRoute();
    this.configureApiRoutes();
  }

  private configureApiRoutes(): void {
    const apiRouter = createApiRouter(this.serverManager);
    this.app.use("/api", apiRouter);
  }

  private resolveProjectFilter(
    req: express.Request,
    options?: { skipValidation?: boolean },
  ): { projectId: string | null; provided: boolean } {
    const headerValue = req.headers[PROJECT_HEADER];
    if (headerValue === undefined) {
      return { projectId: null, provided: false };
    }

    const rawValue = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const value = rawValue?.trim();

    if (!value) {
      return { projectId: null, provided: true };
    }

    if (value === UNASSIGNED_PROJECT_ID) {
      return { projectId: null, provided: true };
    }

    if (options?.skipValidation) {
      return { projectId: value, provided: true };
    }

    const repo = ProjectRepository.getInstance();
    const byName = repo.findByName(value);
    if (byName) {
      return { projectId: byName.id, provided: true };
    }

    const error = new Error(`Project "${value}" not found`);
    (error as any).status = 400;
    throw error;
  }

  private attachRequestMetadata(
    payload: any,
    tokenHeader: string | string[] | undefined,
    projectId: string | null,
  ): void {
    const tokenValue = Array.isArray(tokenHeader)
      ? tokenHeader[0]
      : tokenHeader;

    if (payload.params && typeof payload.params === "object") {
      payload.params._meta = {
        ...(payload.params._meta || {}),
        token: tokenValue,
        projectId,
      };
    } else if (payload.params === undefined) {
      payload.params = {
        _meta: {
          token: tokenValue,
          projectId,
        },
      };
    }
  }

  /**
   * Resolve the Streamable HTTP transport for a request.
   *
   * If the request carries an `mcp-session-id` header the existing session
   * transport is returned. Otherwise a brand-new stateful session is created
   * (the SDK will generate and return the session ID in the response headers).
   */
  private async resolveStreamableTransport(
    req: express.Request,
    res: express.Response,
  ): Promise<
    | { transport: import("@modelcontextprotocol/sdk/server/streamableHttp").StreamableHTTPServerTransport }
    | null
  > {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId) {
      const existing = this.aggregatorServer.getSessionTransport(sessionId);
      if (existing) return { transport: existing };

      // Session not found or expired -- 404 per MCP spec.
      if (!res.headersSent) {
        res.status(404).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Session not found or expired",
          },
          id: null,
        });
      }
      return null;
    }

    // No session header -- create a new session (initialization).
    const transport = await this.aggregatorServer.createSessionTransport();
    return { transport };
  }

  /**
   * Configure direct MCP route without versioning.
   *
   * Handles POST (JSON-RPC requests), GET (SSE stream), and DELETE (session
   * termination) on `/mcp` as specified by the MCP Streamable HTTP transport.
   */
  private configureMcpRoute(): void {
    // POST /mcp - Handle MCP JSON-RPC requests
    this.app.post("/mcp", async (req, res) => {
      // Copy the original request body
      const modifiedBody = { ...req.body };

      try {
        const platformManager = getPlatformAPIManager();
        let projectFilter: string | null;
        try {
          const resolution = this.resolveProjectFilter(req, {
            skipValidation: platformManager.isRemoteWorkspace(),
          });
          projectFilter = resolution.projectId;
        } catch (error: any) {
          if (!res.headersSent) {
            res.status(error?.status || 400).json({
              jsonrpc: "2.0",
              error: {
                code: -32602,
                message:
                  error instanceof Error
                    ? error.message
                    : "Invalid project header",
              },
              id: modifiedBody.id || null,
            });
          }
          return;
        }

        // Append metadata for downstream handlers
        const token = req.headers["authorization"];
        this.attachRequestMetadata(modifiedBody, token, projectFilter);

        const result = await this.resolveStreamableTransport(req, res);
        if (!result) return; // error response already sent
        await result.transport.handleRequest(req, res, modifiedBody);
      } catch (error) {
        console.error("Error handling MCP request:", error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: "Internal server error",
            },
            id: null,
          });
        }
      }
    });

    // GET /mcp - SSE stream for server-initiated messages (Streamable HTTP)
    this.app.get("/mcp", async (req, res) => {
      try {
        const result = await this.resolveStreamableTransport(req, res);
        if (!result) return;
        await result.transport.handleRequest(req, res);
      } catch (error) {
        console.error("Error handling MCP GET request:", error);
        if (!res.headersSent) {
          res.status(500).send("Internal server error");
        }
      }
    });

    // DELETE /mcp - Explicit session termination (MCP spec)
    this.app.delete("/mcp", async (req, res) => {
      try {
        const result = await this.resolveStreamableTransport(req, res);
        if (!result) return;
        await result.transport.handleRequest(req, res);
      } catch (error) {
        console.error("Error handling MCP DELETE request:", error);
        if (!res.headersSent) {
          res.status(500).send("Internal server error");
        }
      }
    });
  }

  /**
   * Configure SSE route for MCP
   */
  private configureMcpSseRoute(): void {
    // GET /mcp/sse - Handle SSE connection setup
    this.app.get("/mcp/sse", async (req, res) => {
      try {
        // Set headers
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        // Create SSE server transport
        const messageEndpoint = "/mcp/messages";
        const transport = new SSEServerTransport(messageEndpoint, res);

        // Get the unique session ID
        const sessionId = transport.sessionId;

        // Check if current workspace is remote
        const platformManager = getPlatformAPIManager();
        let projectFilter: string | null;
        try {
          const resolution = this.resolveProjectFilter(req, {
            skipValidation: platformManager.isRemoteWorkspace(),
          });
          projectFilter = resolution.projectId;
        } catch (error: any) {
          if (!res.headersSent) {
            res
              .status(error?.status || 400)
              .send(
                error instanceof Error
                  ? error.message
                  : "Invalid project header",
              );
          }
          transport.close();
          return;
        }

        // Save the session
        this.sseSessions.set(sessionId, transport);
        this.sseSessionProjects.set(sessionId, projectFilter);

        // Cleanup when the client disconnects
        res.on("close", () => {
          this.sseSessions.delete(sessionId);
          this.sseSessionProjects.delete(sessionId);
        });

        // Create a fresh Server per SSE connection (SDK only allows one transport per Server)
        const sseServer = this.aggregatorServer.createSseServer();
        await sseServer.connect(transport);

        // Send session ID info to the client
        res.write(`data: ${JSON.stringify({ sessionId })}\n\n`);
      } catch (error) {
        console.error("Error establishing SSE connection:", error);
        if (!res.headersSent) {
          res.status(500).send("Error establishing SSE connection");
        }
      }
    });

    // POST /mcp/messages - Handle client-to-server messages
    this.app.post("/mcp/messages", async (req, res) => {
      try {
        // Get session ID from query parameter or header
        const sessionId =
          (req.query.sessionId as string) ||
          (req.headers["mcp-session-id"] as string);

        if (!sessionId) {
          res.status(400).json({
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: "Session ID is required",
            },
            id: null,
          });
          return;
        }

        // Look up the session
        const transport = this.sseSessions.get(sessionId);
        if (!transport) {
          res.status(404).json({
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: "Session not found or expired",
            },
            id: null,
          });
          return;
        }

        // Copy the request body
        const modifiedBody = { ...req.body };

        let projectFilter: string | null;
        try {
          const resolution = this.resolveProjectFilter(req);
          if (resolution.provided) {
            projectFilter = resolution.projectId;
          } else {
            projectFilter = this.sseSessionProjects.get(sessionId) ?? null;
          }
        } catch (error: any) {
          if (!res.headersSent) {
            res.status(error?.status || 400).json({
              jsonrpc: "2.0",
              error: {
                code: -32602,
                message:
                  error instanceof Error
                    ? error.message
                    : "Invalid project header",
              },
              id: modifiedBody.id || null,
            });
          }
          return;
        }

        const token = req.headers["authorization"];
        this.attachRequestMetadata(modifiedBody, token, projectFilter);

        // Process the message via transport
        await transport.handlePostMessage(req, res, modifiedBody);
      } catch (error) {
        console.error("Error handling SSE message:", error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: "Internal server error",
            },
            id: null,
          });
        }
      }
    });
  }

  /**
   * Start the HTTP server
   */
  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, "127.0.0.1", () => {
          resolve();
        });

        this.server.on("error", (error: Error) => {
          console.error("HTTP Server error:", error);
          reject(error);
        });
      } catch (error) {
        console.error("Failed to start HTTP Server:", error);
        reject(error);
      }
    });
  }

  /**
   * Stop the HTTP server
   */
  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((error?: Error) => {
        if (error) {
          console.error("Error stopping HTTP Server:", error);
          reject(error);
          return;
        }

        this.server = null;
        resolve();
      });
    });
  }
}
