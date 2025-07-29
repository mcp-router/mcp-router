import express from "express";
import cors from "cors";
import * as http from "http";
import { MCPServerManager } from "..";
import { getLogService } from "@/main/application/mcp-core/log/log-service";
import { getTokenService } from "@/main/domain/mcp-core/token/token-service";
import { listMcpApps } from "@/main/application/mcp-core/apps/mcp-apps-service";
import {
  validateMcpServerJson,
  processMcpServerConfigs,
} from "@/main/domain/mcp-core/server/shared/mcp-server-utils";
import { TokenScope } from "@mcp_router/shared";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse";
import { getPlatformAPIManager } from "../../../workspace/platform-api-manager";

/**
 * HTTP server that exposes MCP functionality through REST endpoints
 */
export class MCPHttpServer {
  private app: express.Application;
  private server: http.Server | null = null;
  private port: number;
  private serverManager: MCPServerManager;
  private tokenService = getTokenService();
  private v0Router: express.Router;
  // SSEセッション用のマップ
  private sseSessions: Map<string, SSEServerTransport> = new Map();

  constructor(serverManager: MCPServerManager, port: number) {
    this.serverManager = serverManager;
    this.port = port;
    this.app = express();
    this.v0Router = express.Router();
    this.configureMiddleware();
    this.configureRoutes();
  }

  /**
   * Configure Express middleware
   */
  private configureMiddleware(): void {
    // Parse JSON request bodies
    this.app.use(express.json());

    // Enable CORS
    this.app.use(cors());

    // 認証ミドルウェアの作成
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
      const validation = this.tokenService.validateToken(tokenId);

      if (!validation.isValid) {
        // Invalid token
        res.status(401).json({
          error: validation.error || "Invalid token. Authentication failed.",
        });
        return;
      }

      // Check token scope based on the endpoint path
      const path = req.path;
      let requiredScope: TokenScope | null = null;

      // Determine required scope based on endpoint path - バージョンプレフィックスなし
      if (path.startsWith("/servers")) {
        requiredScope = TokenScope.MCP_SERVER_MANAGEMENT;
      } else if (path.startsWith("/logs")) {
        requiredScope = TokenScope.LOG_MANAGEMENT;
      } else if (path.startsWith("/apps")) {
        requiredScope = TokenScope.APPLICATION;
      } else if (path === "/mcp" || path === "/mcp/sse") {
        // スコープは不要
        requiredScope = null;
      }

      // Verify scope if applicable
      if (
        requiredScope &&
        !this.tokenService.hasScope(tokenId, requiredScope)
      ) {
        res.status(403).json({
          error: `Insufficient permissions. Token does not have the required scope: ${requiredScope}`,
        });
        return;
      }

      // Token is valid and has proper scope, proceed to the next middleware or route handler
      next();
    };

    // バージョン別のルーターに認証ミドルウェアを適用
    this.v0Router.use(authMiddleware);

    // メインアプリにv0ルーターをマウント
    this.app.use("/v0", this.v0Router);

    // /mcp エンドポイントを直接ルートに設定し、バージョニングなしで公開
    this.app.use("/mcp", authMiddleware);

    // /mcp/sse エンドポイントを直接ルートに設定し、バージョニングなしで公開
    this.app.use("/mcp/sse", authMiddleware);
  }

  /**
   * Configure API routes
   */
  private configureRoutes(): void {
    this.configureAggregatorRoutes();
    this.configureLogRoutes();
    this.configureAppsRoutes();
    this.configureMcpRoute();
    this.configureMcpSseRoute();
  }

  /**
   * Configure direct MCP route without versioning
   */
  private configureMcpRoute(): void {
    // POST /mcp - Handle MCP requests (direct route without versioning)
    this.app.post("/mcp", async (req, res) => {
      // オリジナルのリクエストボディをコピー
      const modifiedBody = { ...req.body };

      try {
        // Check if current workspace is remote
        const platformManager = getPlatformAPIManager();
        if (platformManager.isRemoteWorkspace()) {
          // For remote workspaces, forward to remote aggregator
          const remoteApiUrl = platformManager.getRemoteApiUrl();
          if (!remoteApiUrl) {
            throw new Error("Remote workspace has no API URL configured");
          }

          // Get user auth token instead of workspace token
          const { getDecryptedAuthToken } = await import(
            "../../../../domain/auth/auth"
          );
          const authToken = await getDecryptedAuthToken();

          // Forward the request to remote aggregator
          await this.forwardToRemoteAggregator(
            remoteApiUrl,
            authToken || undefined,
            req,
            res,
            modifiedBody,
          );
        } else {
          // トークンをメタデータとして追加（ログに記録されないよう処理）
          // JSONRPCリクエストの標準形式に従って、paramsにメタデータを追加
          const token = req.headers["authorization"];
          if (modifiedBody.params && typeof modifiedBody.params === "object") {
            // パラメータが既に存在する場合、_metaを追加/上書き
            modifiedBody.params._meta = {
              ...(modifiedBody.params._meta || {}),
              token: token, // トークンは内部処理用に使い、ログには記録しない
            };
          } else if (modifiedBody.params === undefined) {
            // パラメータが存在しない場合は新規作成
            modifiedBody.params = {
              _meta: { token: token }, // トークンは内部処理用に使い、ログには記録しない
            };
          }
          // For local workspaces, use local aggregator
          await this.serverManager
            .getTransport()
            .handleRequest(req, res, modifiedBody);
        }
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
  }

  /**
   * Configure SSE route for MCP
   */
  private configureMcpSseRoute(): void {
    // GET /mcp/sse - Handle SSE connection setup
    this.app.get("/mcp/sse", async (_req, res) => {
      try {
        // ヘッダーを設定
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        // SSEサーバートランスポートの作成
        const messageEndpoint = "/mcp/messages";
        const transport = new SSEServerTransport(messageEndpoint, res);

        // ユニークなセッションIDを取得
        const sessionId = transport.sessionId;

        // セッションの保存
        this.sseSessions.set(sessionId, transport);

        // クライアントが切断したときのクリーンアップ
        res.on("close", () => {
          this.sseSessions.delete(sessionId);
        });

        // Check if current workspace is remote
        const platformManager = getPlatformAPIManager();
        if (platformManager.isRemoteWorkspace()) {
          // For remote workspaces, we need to connect to remote aggregator
          // Note: This requires implementing a remote aggregator SSE endpoint
          // For now, we'll use the local aggregator but log a warning
          console.warn(
            "Remote aggregator SSE not yet implemented, using local aggregator",
          );
          await this.serverManager.getAggregatorServer().connect(transport);
        } else {
          // For local workspaces, connect to local aggregator server
          await this.serverManager.getAggregatorServer().connect(transport);
        }

        // セッションID情報をクライアントに送信
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
        // セッションIDをクエリパラメータまたはヘッダーから取得
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

        // セッションを検索
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

        // リクエストボディをコピー
        const modifiedBody = { ...req.body };

        // トークンをメタデータとして追加
        const token = req.headers["authorization"];
        if (modifiedBody.params && typeof modifiedBody.params === "object") {
          modifiedBody.params._meta = {
            ...(modifiedBody.params._meta || {}),
            token: token,
          };
        } else if (modifiedBody.params === undefined) {
          modifiedBody.params = {
            _meta: { token: token },
          };
        }

        // トランスポートでメッセージを処理
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
   * Configure routes for MCP Apps API
   */
  private configureAppsRoutes(): void {
    // GET /apps - Get all MCP apps
    this.v0Router.get(
      "/apps",
      async (req: express.Request, res: express.Response) => {
        try {
          const apps = await listMcpApps();
          // Filter out sensitive information from the app objects
          const filteredApps = apps.map((app: any) => {
            return {
              name: app.name,
              installed: app.installed,
              configured: app.configured,
              servers: app.serverIds,
              official: !app.isCustom,
              scopes: app.scopes,
            };
          });
          res.json({ apps: filteredApps });
        } catch (error: any) {
          console.error("Error getting MCP apps:", error);
          res.status(500).json({
            error: {
              code: "APPS_LIST_ERROR",
              message: error.message || "Failed to retrieve MCP apps list",
            },
          });
        }
      },
    );
  }

  /**
   * Configure routes for log API
   */
  private configureLogRoutes(): void {
    const logService = getLogService();

    // GET /logs - Retrieve logs with filtering and pagination
    this.v0Router.get(
      "/logs",
      async (req: express.Request, res: express.Response) => {
        try {
          const options: {
            clientId?: string;
            serverId?: string;
            requestType?: string;
            responseStatus?: "success" | "error";
            startDate?: Date;
            endDate?: Date;
            cursor?: string;
            limit?: number;
          } = {
            clientId: req.query.clientId as string | undefined,
            serverId: req.query.serverId as string | undefined,
            requestType: req.query.requestType as string | undefined,
            responseStatus: req.query.responseStatus as
              | "success"
              | "error"
              | undefined,
            cursor: req.query.cursor as string | undefined,
            limit: req.query.limit
              ? parseInt(req.query.limit as string)
              : undefined,
          };

          // Handle date parameters
          if (req.query.startDate) {
            options.startDate = new Date(req.query.startDate as string);
          }
          if (req.query.endDate) {
            options.endDate = new Date(req.query.endDate as string);
          }

          const result = await logService.getRequestLogs(options);

          res.json({
            logs: result.logs,
            total: result.total,
            nextCursor: result.nextCursor,
            hasMore: result.hasMore,
            limit: options.limit || 50,
          });
        } catch (error: any) {
          console.error("Error getting logs:", error);
          res.status(500).json({
            error: {
              code: "LOGS_RETRIEVAL_ERROR",
              message: error.message || "Failed to retrieve logs",
            },
          });
        }
      },
    );

    // GET /logs/stats - Get log statistics
    this.v0Router.get(
      "/logs/stats",
      (req: express.Request, res: express.Response) => {
        try {
          const type = req.query.type as string | undefined;
          let response: any = {};

          // If specific type is requested, return only that stat type
          if (type === "client") {
            response.clientStats = logService.getClientStats();
          } else if (type === "server") {
            response.serverStats = logService.getServerStats();
          } else if (type === "requestType") {
            response.requestTypeStats = logService.getRequestTypeStats();
          } else {
            // Return all stats by default
            response = {
              clientStats: logService.getClientStats(),
              serverStats: logService.getServerStats(),
              requestTypeStats: logService.getRequestTypeStats(),
            };
          }

          res.json(response);
        } catch (error: any) {
          console.error("Error getting log stats:", error);
          res.status(500).json({
            error: {
              code: "STATS_RETRIEVAL_ERROR",
              message: error.message || "Failed to retrieve log statistics",
            },
          });
        }
      },
    );

    // GET /logs/clients - Get available client IDs
    this.v0Router.get(
      "/logs/clients",
      (req: express.Request, res: express.Response) => {
        try {
          const clients = logService.getAvailableClientIds();
          res.json({ clients });
        } catch (error: any) {
          console.error("Error getting client IDs:", error);
          res.status(500).json({
            error: {
              code: "CLIENT_LIST_ERROR",
              message: error.message || "Failed to retrieve client list",
            },
          });
        }
      },
    );

    // GET /logs/types - Get available request types
    this.v0Router.get(
      "/logs/types",
      (req: express.Request, res: express.Response) => {
        try {
          const types = logService.getAvailableRequestTypes();
          res.json({ types });
        } catch (error: any) {
          console.error("Error getting request types:", error);
          res.status(500).json({
            error: {
              code: "REQUEST_TYPES_ERROR",
              message: error.message || "Failed to retrieve request types",
            },
          });
        }
      },
    );

    // The /:id route must be last as it can match any path segment
    // GET /logs/:id - Get a specific log entry by ID
    this.v0Router.get(
      "/logs/:id",
      (req: express.Request, res: express.Response) => {
        try {
          const logId = req.params.id;

          if (!logId) {
            res.status(400).json({
              error: {
                code: "MISSING_LOG_ID",
                message: "Log ID is required",
              },
            });
            return;
          }

          const log = logService.getLogById(logId);

          if (!log) {
            res.status(404).json({
              error: {
                code: "LOG_NOT_FOUND",
                message: `Log with ID ${logId} not found`,
              },
            });
            return;
          }

          res.json(log);
        } catch (error: any) {
          console.error("Error getting log by ID:", error);
          res.status(500).json({
            error: {
              code: "LOG_RETRIEVAL_ERROR",
              message: error.message || "Failed to retrieve log",
            },
          });
        }
      },
    );
  }

  private configureAggregatorRoutes(): void {
    // POST /servers/:id/start - Start a specific MCP server
    this.v0Router.post(
      "/servers/:id/start",
      async (req: express.Request, res: express.Response) => {
        try {
          const serverId = req.params.id;

          // Get client ID from token
          const token = req.headers["authorization"] as string;
          let clientId = "http-client"; // Default value

          if (token) {
            // Extract client ID from token
            const extractedClientId =
              this.tokenService.getClientIdFromToken(token);
            if (extractedClientId) {
              clientId = extractedClientId;
            }
          }

          if (!serverId) {
            res.status(400).json({
              error: {
                code: "MISSING_SERVER_ID",
                message: "Server ID is required",
              },
            });
            return;
          }

          // Check if the server exists in the manager
          const servers = this.serverManager.getServers();
          const serverExists = servers.some((s) => s.id === serverId);

          if (!serverExists) {
            res.status(404).json({
              error: {
                code: "SERVER_NOT_FOUND",
                message: `Server with ID ${serverId} not found`,
              },
            });
            return;
          }

          // Start the server with client ID
          const success = await this.serverManager.startServer(
            serverId,
            clientId,
          );

          if (success) {
            res.status(200).json({
              success: true,
              message: "Server started successfully",
              status: this.serverManager.getServerStatus(serverId),
            });
          } else {
            res.status(500).json({
              error: {
                code: "SERVER_START_FAILED",
                message: "Failed to start server",
                status: this.serverManager.getServerStatus(serverId),
              },
            });
          }
        } catch (error: any) {
          console.error("Error starting server:", error);
          res.status(500).json({
            error: {
              code: "SERVER_START_ERROR",
              message: error.message || "An unexpected error occurred",
            },
          });
        }
      },
    );

    // POST /servers/:id/stop - Stop a specific MCP server
    this.v0Router.post(
      "/servers/:id/stop",
      async (req: express.Request, res: express.Response) => {
        try {
          const serverId = req.params.id;

          // Get client ID from token
          const token = req.headers["authorization"] as string;
          let clientId = "http-client"; // Default value

          if (token) {
            // Extract client ID from token
            const extractedClientId =
              this.tokenService.getClientIdFromToken(token);
            if (extractedClientId) {
              clientId = extractedClientId;
            }
          }

          if (!serverId) {
            res.status(400).json({
              error: {
                code: "MISSING_SERVER_ID",
                message: "Server ID is required",
              },
            });
            return;
          }

          // Check if the server exists in the manager
          const servers = this.serverManager.getServers();
          const serverExists = servers.some((s) => s.id === serverId);

          if (!serverExists) {
            res.status(404).json({
              error: {
                code: "SERVER_NOT_FOUND",
                message: `Server with ID ${serverId} not found`,
              },
            });
            return;
          }

          // Stop the server with client ID
          const success = this.serverManager.stopServer(serverId, clientId);

          if (success) {
            res.status(200).json({
              success: true,
              message: "Server stopped successfully",
              status: this.serverManager.getServerStatus(serverId),
            });
          } else {
            res.status(500).json({
              error: {
                code: "SERVER_STOP_FAILED",
                message: "Failed to stop server",
                status: this.serverManager.getServerStatus(serverId),
              },
            });
          }
        } catch (error: any) {
          console.error("Error stopping server:", error);
          res.status(500).json({
            error: {
              code: "SERVER_STOP_ERROR",
              message: error.message || "An unexpected error occurred",
            },
          });
        }
      },
    );

    // DELETE /servers/:id - Remove a specific MCP server
    this.v0Router.delete(
      "/servers/:id",
      async (req: express.Request, res: express.Response) => {
        try {
          const serverId = req.params.id;

          if (!serverId) {
            res.status(400).json({
              error: {
                code: "MISSING_SERVER_ID",
                message: "Server ID is required",
              },
            });
            return;
          }

          // Check if the server exists in the manager
          const servers = this.serverManager.getServers();
          const server = servers.find((s) => s.id === serverId);

          if (!server) {
            res.status(404).json({
              error: {
                code: "SERVER_NOT_FOUND",
                message: `Server with ID ${serverId} not found`,
              },
            });
            return;
          }

          // Remove the server
          const success = this.serverManager.removeServer(serverId);

          if (success) {
            res.status(200).json({
              success: true,
              message: `Server "${server.name}" removed successfully`,
            });
          } else {
            res.status(500).json({
              error: {
                code: "SERVER_REMOVE_FAILED",
                message: `Failed to remove server "${server.name}"`,
              },
            });
          }
        } catch (error: any) {
          console.error("Error removing server:", error);
          res.status(500).json({
            error: {
              code: "SERVER_REMOVE_ERROR",
              message:
                error.message ||
                "An unexpected error occurred while removing the server",
            },
          });
        }
      },
    );

    // GET /servers - List all MCP servers
    this.v0Router.get(
      "/servers",
      (req: express.Request, res: express.Response) => {
        try {
          const servers = this.serverManager.getServers();
          // Filter out sensitive information from the server objects
          const filteredServers = servers.map((server) => {
            return {
              id: server.id,
              name: server.name,
              description: server.description,
              status: server.status,
              version: server.version,
            };
          });
          res.json({ servers: filteredServers });
        } catch (error: any) {
          console.error("Error getting servers:", error);
          res.status(500).json({ error: error.message });
        }
      },
    );

    // POST /servers - Add MCP servers from JSON format
    this.v0Router.post(
      "/servers",
      async (req: express.Request, res: express.Response) => {
        try {
          // Validate the input JSON
          const validation = validateMcpServerJson(req.body);

          if (!validation.valid || !validation.serverConfigs) {
            res.status(400).json({
              error: {
                code: "INVALID_SERVER_CONFIG",
                message:
                  validation.error || "Missing or invalid server configuration",
              },
            });
            return;
          }

          // Get existing servers to prevent name conflicts
          const existingServers = this.serverManager.getServers();
          const existingServerNames = new Set<string>(
            existingServers.map((server) => server.name),
          );

          // Process server configurations using the utility function
          const processedResults = processMcpServerConfigs(
            validation.serverConfigs,
            existingServerNames,
          );

          // Add the servers to the server manager
          const results = [];

          for (const result of processedResults) {
            if (result.success && result.server) {
              try {
                // Add the server
                this.serverManager.addServer(result.server);
                results.push({
                  name: result.name,
                  success: true,
                  message: `Server ${result.name} added successfully`,
                });
              } catch (error: any) {
                results.push({
                  name: result.name,
                  success: false,
                  message: `Error adding server: ${error.message}`,
                });
              }
            } else {
              results.push(result);
            }
          }

          // If at least one server was successfully added, return 201 Created
          const hasSuccess = results.some((result) => result.success);
          const statusCode = hasSuccess ? 201 : 400;

          res.status(statusCode).json({ results });
        } catch (error: any) {
          console.error("Error adding servers:", error);
          res.status(500).json({
            error: {
              code: "SERVER_CREATION_ERROR",
              message: error.message || "Failed to add servers",
            },
          });
        }
      },
    );
  }

  /**
   * Start the HTTP server
   */
  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
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
   * Forward MCP request to remote aggregator
   */
  private async forwardToRemoteAggregator(
    remoteApiUrl: string,
    authToken: string | undefined,
    req: express.Request,
    res: express.Response,
    body: any,
  ): Promise<void> {
    try {
      // Construct the remote MCP endpoint URL
      const remoteUrl = new URL(remoteApiUrl + "/mcp");

      // Forward the request to the remote aggregator
      const response = await fetch(remoteUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken && { Authorization: `Bearer ${authToken}` }),
        },
        body: JSON.stringify(body),
      });

      // Get the response body
      const responseData = await response.text();

      // Set the response status and headers
      res.status(response.status);

      // Forward relevant headers
      const contentType = response.headers.get("content-type");
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }

      // Send the response
      res.send(responseData);
    } catch (error) {
      console.error("Error forwarding to remote aggregator:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Failed to connect to remote aggregator",
          },
          id: body.id || null,
        });
      }
    }
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
