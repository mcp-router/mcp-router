import { Router, Request, Response } from "express";
import type { MCPServerManager } from "../../mcp-server-manager/mcp-server-manager";
import { getMarketplaceService } from "../../marketplace/marketplace.service";
import { getEventBridge } from "../event-bridge";
import { TokenManager } from "../../client-apps/token-manager";

type ApiEvent = {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
};

const SERVER_SCOPED_EVENT_TYPES = new Set([
  "servers_updated",
  "tool_list_changed",
  "resource_list_changed",
  "config_changed",
  "auth_challenge",
]);

function getRouteParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && value.length > 0) {
    return value[0];
  }

  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return null;
}

export function collectServerIdsFromEventData(
  data: Record<string, unknown>,
): string[] {
  const ids = new Set<string>();
  const collectFromRecord = (record: Record<string, unknown>) => {
    const serverId = record.serverId;
    const id = record.id;

    if (typeof serverId === "string" && serverId.length > 0) {
      ids.add(serverId);
    }

    if (typeof id === "string" && id.length > 0) {
      ids.add(id);
    }

    const nestedServer = asRecord(record.server);
    if (nestedServer && typeof nestedServer.id === "string") {
      ids.add(nestedServer.id);
    }
  };

  collectFromRecord(data);

  const result = data.result;
  if (Array.isArray(result)) {
    for (const item of result) {
      const record = asRecord(item);
      if (record) {
        collectFromRecord(record);
      }
    }
  } else {
    const resultRecord = asRecord(result);
    if (resultRecord) {
      collectFromRecord(resultRecord);
    }
  }

  return Array.from(ids);
}

export function isApiEventAuthorized(
  token: string | null,
  event: ApiEvent,
  hasServerAccess: (token: string, serverId: string) => boolean,
): boolean {
  if (!token) {
    return false;
  }

  if (!SERVER_SCOPED_EVENT_TYPES.has(event.type)) {
    return true;
  }

  const serverIds = collectServerIdsFromEventData(event.data);
  if (serverIds.length === 0) {
    // Allow non-server config events (settings/workspace updates, etc.)
    return true;
  }

  return serverIds.every((serverId) => hasServerAccess(token, serverId));
}

export function createApiRouter(serverManager: MCPServerManager): Router {
  const router = Router();
  const tokenManager = new TokenManager();

  function getRequestToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    const raw = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    if (!raw) return null;
    return raw.startsWith("Bearer ") ? raw.slice(7) : raw;
  }

  function hasServerAccess(req: Request, serverId: string): boolean {
    const token = getRequestToken(req);
    return token ? tokenManager.hasServerAccess(token, serverId) : false;
  }

  // GET /api/health - Health check endpoint
  router.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "0.0.0",
    });
  });

  // GET /api/servers - List all MCP servers
  router.get("/servers", (req: Request, res: Response) => {
    try {
      const servers = serverManager
        .getServers()
        .filter((server) => hasServerAccess(req, server.id));
      res.json({ servers });
    } catch (error) {
      res.status(500).json({
        error:
          error instanceof Error ? error.message : "Failed to list servers",
      });
    }
  });

  // POST /api/servers/:id/start - Start a server
  router.post("/servers/:id/start", async (req: Request, res: Response) => {
    try {
      const id = getRouteParam(req.params.id);
      if (!id) {
        res.status(400).json({ error: "Server ID is required" });
        return;
      }
      if (!hasServerAccess(req, id)) {
        res
          .status(403)
          .json({ error: "Forbidden: token has no access to this server" });
        return;
      }
      const result = await serverManager.startServer(id, "REST API");
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({
        error:
          error instanceof Error ? error.message : "Failed to start server",
      });
    }
  });

  // POST /api/servers/:id/stop - Stop a server
  router.post("/servers/:id/stop", (req: Request, res: Response) => {
    try {
      const id = getRouteParam(req.params.id);
      if (!id) {
        res.status(400).json({ error: "Server ID is required" });
        return;
      }
      if (!hasServerAccess(req, id)) {
        res
          .status(403)
          .json({ error: "Forbidden: token has no access to this server" });
        return;
      }
      const result = serverManager.stopServer(id, "REST API");
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to stop server",
      });
    }
  });

  // GET /api/servers/:id/tools - List server tools
  router.get("/servers/:id/tools", async (req: Request, res: Response) => {
    try {
      const id = getRouteParam(req.params.id);
      if (!id) {
        res.status(400).json({ error: "Server ID is required" });
        return;
      }
      if (!hasServerAccess(req, id)) {
        res
          .status(403)
          .json({ error: "Forbidden: token has no access to this server" });
        return;
      }
      const tools = await serverManager.listServerTools(id);
      res.json({ tools });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to list tools",
      });
    }
  });

  // GET /api/events - SSE event stream
  router.get("/events", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const eventBridge = getEventBridge();
    const token = getRequestToken(req);

    const sendEvent = (event: ApiEvent) => {
      if (
        !isApiEventAuthorized(token, event, (requestToken, serverId) =>
          tokenManager.hasServerAccess(requestToken, serverId),
        )
      ) {
        return;
      }
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    // Send initial connection event
    sendEvent({
      type: "connected",
      data: { message: "SSE connection established" },
      timestamp: new Date().toISOString(),
    });

    // Subscribe to events
    const unsubscribe = eventBridge.subscribe(sendEvent);

    // Start heartbeat if this is first subscriber
    if (eventBridge.getSubscriberCount() === 1) {
      eventBridge.startHeartbeat(30000);
    }

    // Cleanup on disconnect
    req.on("close", () => {
      unsubscribe();
      if (eventBridge.getSubscriberCount() === 0) {
        eventBridge.stopHeartbeat();
      }
    });
  });

  // GET /api/marketplace - Search marketplace
  router.get("/marketplace", async (req: Request, res: Response) => {
    try {
      const service = getMarketplaceService();
      const options = {
        search: req.query.search as string,
        limit: req.query.limit
          ? parseInt(req.query.limit as string, 10)
          : undefined,
        cursor: req.query.cursor as string,
      };
      const result = await service.searchServers(options);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error:
          error instanceof Error ? error.message : "Marketplace search failed",
      });
    }
  });

  // GET /api/marketplace/:serverName - Get server details
  router.get(
    "/marketplace/:serverName",
    async (req: Request, res: Response) => {
      try {
        const service = getMarketplaceService();
        const serverName = getRouteParam(req.params.serverName);
        if (!serverName) {
          res.status(400).json({ error: "Server name is required" });
          return;
        }

        const details = await service.getServerDetails(serverName);
        if (!details) {
          res.status(404).json({ error: "Server not found" });
          return;
        }
        res.json(details);
      } catch (error) {
        res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : "Failed to get server details",
        });
      }
    },
  );

  return router;
}
