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

const MAX_AUTHORIZATION_HEADER_LENGTH = 512;
const MAX_PROJECT_HEADER_LENGTH = 128;
const BEARER_TOKEN_PATTERN = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/;
const DEFAULT_HTTP_HOST = "127.0.0.1";

function hasHttpHeaderControlChars(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

/**
 * HTTP server that exposes MCP functionality through REST endpoints
 */
export class MCPHttpServer {
  private app: express.Application;
  private server: http.Server | null = null;
  private port: number;
  private host: string;
  private aggregatorServer: AggregatorServer;
  private tokenValidator: TokenValidator;
  // SSEセッション用のマップ
  private sseSessions: Map<string, SSEServerTransport> = new Map();
  private sseSessionProjects: Map<string, string | null> = new Map();

  constructor(
    serverManager: MCPServerManager,
    port: number,
    aggregatorServer?: AggregatorServer,
    host = DEFAULT_HTTP_HOST,
  ) {
    this.aggregatorServer =
      aggregatorServer || new AggregatorServer(serverManager);
    this.port = port;
    this.host = host;
    this.app = express();
    // TokenValidatorはサーバー名とIDのマッピングが必要
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

    // Enable CORS
    this.app.use(cors());

    // 認証ミドルウェアの作成
    const authMiddleware = (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      // Log the request without sensitive token information
      // console.log(`[HTTP] ${req.method} ${req.url}${clientName ? ` (Client: ${clientName})` : ''}, Body = ${JSON.stringify(req.body)}`);
      // Token validation middleware
      const tokenId = this.extractBearerToken(req.headers["authorization"]);
      if (!tokenId) {
        // No token provided
        res.status(401).json({
          error: "Authentication required. Please provide a valid token.",
        });
        return;
      }

      req.headers["authorization"] = tokenId;

      // Validate the token
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

    // /mcp エンドポイントを直接ルートに設定し、バージョニングなしで公開
    this.app.use("/mcp", authMiddleware);

    // /mcp/sse エンドポイントを直接ルートに設定し、バージョニングなしで公開
    this.app.use("/mcp/sse", authMiddleware);
  }

  private extractBearerToken(
    headerValue: string | string[] | undefined,
  ): string | null {
    if (Array.isArray(headerValue) || typeof headerValue !== "string") {
      return null;
    }

    if (
      headerValue.length > MAX_AUTHORIZATION_HEADER_LENGTH ||
      hasHttpHeaderControlChars(headerValue)
    ) {
      return null;
    }

    const match = BEARER_TOKEN_PATTERN.exec(headerValue);
    if (!match) {
      return null;
    }

    return match[1];
  }

  private getSingleHeaderValue(
    headerValue: string | string[] | undefined,
  ): string | undefined {
    if (Array.isArray(headerValue)) {
      if (headerValue.length !== 1) {
        return undefined;
      }
      return headerValue[0];
    }

    return headerValue;
  }

  private sanitizeProjectHeader(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }

    if (
      trimmed.length > MAX_PROJECT_HEADER_LENGTH ||
      hasHttpHeaderControlChars(trimmed)
    ) {
      return null;
    }

    return trimmed;
  }

  /**
   * Configure API routes
   */
  private configureRoutes(): void {
    this.configureMcpRoute();
    this.configureMcpSseRoute();
  }

  private resolveProjectFilter(
    req: express.Request,
    options?: { skipValidation?: boolean },
  ): { projectId: string | null; provided: boolean } {
    const headerValue = req.headers[PROJECT_HEADER];
    if (headerValue === undefined) {
      return { projectId: null, provided: false };
    }

    const rawValue = this.getSingleHeaderValue(headerValue);
    if (rawValue === undefined) {
      const error = new Error("Invalid project header");
      (error as any).status = 400;
      throw error;
    }

    const value = this.sanitizeProjectHeader(rawValue);
    if (value === null) {
      const error = new Error("Invalid project header");
      (error as any).status = 400;
      throw error;
    }

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
   * Configure direct MCP route without versioning
   */
  private configureMcpRoute(): void {
    // POST /mcp - Handle MCP requests (direct route without versioning)
    this.app.post("/mcp", async (req, res) => {
      // オリジナルのリクエストボディをコピー
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
        // For local workspaces, use local aggregator
        await this.aggregatorServer
          .getTransport()
          .handleRequest(req, res, modifiedBody);
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
    this.app.get("/mcp/sse", async (req, res) => {
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

        // セッションの保存
        this.sseSessions.set(sessionId, transport);
        this.sseSessionProjects.set(sessionId, projectFilter);

        // クライアントが切断したときのクリーンアップ
        res.on("close", () => {
          this.sseSessions.delete(sessionId);
          this.sseSessionProjects.delete(sessionId);
        });

        if (platformManager.isRemoteWorkspace()) {
          // For remote workspaces, we need to connect to remote aggregator
          // Note: This requires implementing a remote aggregator SSE endpoint
          // For now, we'll use the local aggregator but log a warning
          console.warn(
            "Remote aggregator SSE not yet implemented, using local aggregator",
          );
          await this.aggregatorServer.getAggregatorServer().connect(transport);
        } else {
          // For local workspaces, connect to local aggregator server
          await this.aggregatorServer.getAggregatorServer().connect(transport);
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
   * Start the HTTP server
   */
  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, this.host, () => {
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
