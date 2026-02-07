import { Router, Request, Response } from "express";
import type { MCPServerManager } from "../../mcp-server-manager/mcp-server-manager";
import { getMarketplaceService } from "../../marketplace/marketplace.service";
import { getEventBridge } from "../event-bridge";

function getRouteParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && value.length > 0) {
    return value[0];
  }

  return null;
}

export function createApiRouter(serverManager: MCPServerManager): Router {
  const router = Router();

  // GET /api/health - Health check endpoint
  router.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "0.0.0",
    });
  });

  // GET /api/servers - List all MCP servers
  router.get("/servers", (_req: Request, res: Response) => {
    try {
      const servers = serverManager.getServers();
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

    const sendEvent = (event: {
      type: string;
      data: Record<string, unknown>;
      timestamp: string;
    }) => {
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
