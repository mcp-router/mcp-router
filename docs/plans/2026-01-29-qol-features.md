# MCP Router QoL Features Implementation Plan

> **STATUS: COMPLETED**

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 5 quality-of-life features from mcp-hub: REST API, SSE Event Bridge, MCP Marketplace, Hot Reload, and Structured Logging.

**Architecture:** Extend existing `MCPHttpServer` for REST/SSE, add `EventBridge` service for broadcasting, integrate official MCP Registry API, add chokidar file watching at service layer, replace console logging with Pino.

**Tech Stack:** Express.js (existing), Pino (logging), chokidar (file watching), MCP Registry API (marketplace)

---

## Phase 1: REST API Endpoints

### Task 1.1: Create API Router Module [PENDING]

**Files:**
- Create: `apps/electron/src/main/modules/mcp-server-runtime/http/api-router.ts`
- Test: `apps/electron/src/main/modules/mcp-server-runtime/http/__tests__/api-router.test.ts`

**Step 1: Create test file structure**

```typescript
// apps/electron/src/main/modules/mcp-server-runtime/http/__tests__/api-router.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createApiRouter } from '../api-router';

describe('API Router', () => {
  let app: express.Application;
  let mockServerManager: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    mockServerManager = {
      getServers: vi.fn().mockReturnValue([]),
      startServer: vi.fn().mockResolvedValue({ success: true }),
      stopServer: vi.fn().mockReturnValue({ success: true }),
    };
    app.use('/api', createApiRouter(mockServerManager));
  });

  describe('GET /api/health', () => {
    it('returns healthy status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('GET /api/servers', () => {
    it('returns empty array when no servers', async () => {
      const res = await request(app).get('/api/servers');
      expect(res.status).toBe(200);
      expect(res.body.servers).toEqual([]);
    });

    it('returns server list', async () => {
      mockServerManager.getServers.mockReturnValue([
        { id: 'server-1', name: 'Test Server' }
      ]);
      const res = await request(app).get('/api/servers');
      expect(res.status).toBe(200);
      expect(res.body.servers).toHaveLength(1);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @mcp_router/electron test -- api-router.test.ts`
Expected: FAIL - module not found

**Step 3: Create api-router.ts with health and servers endpoints**

```typescript
// apps/electron/src/main/modules/mcp-server-runtime/http/api-router.ts
import { Router, Request, Response } from 'express';
import type { MCPServerManager } from '../../mcp-server-manager/mcp-server-manager';

export function createApiRouter(serverManager: MCPServerManager): Router {
  const router = Router();

  // GET /api/health - Health check endpoint
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.0.0',
    });
  });

  // GET /api/servers - List all MCP servers
  router.get('/servers', (_req: Request, res: Response) => {
    try {
      const servers = serverManager.getServers();
      res.json({ servers });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to list servers',
      });
    }
  });

  // POST /api/servers/:id/start - Start a server
  router.post('/servers/:id/start', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await serverManager.startServer(id, 'REST API');
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to start server',
      });
    }
  });

  // POST /api/servers/:id/stop - Stop a server
  router.post('/servers/:id/stop', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = serverManager.stopServer(id, 'REST API');
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to stop server',
      });
    }
  });

  // GET /api/servers/:id/tools - List server tools
  router.get('/servers/:id/tools', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const tools = await serverManager.listServerTools(id);
      res.json({ tools });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to list tools',
      });
    }
  });

  return router;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @mcp_router/electron test -- api-router.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/electron/src/main/modules/mcp-server-runtime/http/api-router.ts
git add apps/electron/src/main/modules/mcp-server-runtime/http/__tests__/api-router.test.ts
git commit -m "$(cat <<'EOF'
feat(api): add REST API router with health and server endpoints

Adds /api/health, /api/servers, /api/servers/:id/start,
/api/servers/:id/stop, and /api/servers/:id/tools endpoints.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.2: Integrate API Router into MCPHttpServer [PENDING]

**Files:**
- Modify: `apps/electron/src/main/modules/mcp-server-runtime/http/mcp-http-server.ts:36-38,96-100,105-108`

**Step 1: Add import and router integration**

In `mcp-http-server.ts`, add after line 10:

```typescript
import { createApiRouter } from './api-router';
```

**Step 2: Update configureMiddleware to protect /api routes**

After line 99 (after `/mcp/sse` middleware), add:

```typescript
    // /api routes need authentication
    this.app.use("/api", authMiddleware);
```

**Step 3: Update configureRoutes to include API router**

Replace `configureRoutes()` method (lines 105-108):

```typescript
  private configureRoutes(): void {
    this.configureMcpRoute();
    this.configureMcpSseRoute();
    this.configureApiRoutes();
  }

  private configureApiRoutes(): void {
    const apiRouter = createApiRouter(this.aggregatorServer.getServerManager());
    this.app.use('/api', apiRouter);
  }
```

**Step 4: Verify build passes**

Run: `pnpm --filter @mcp_router/electron build`
Expected: SUCCESS

**Step 5: Commit**

```bash
git add apps/electron/src/main/modules/mcp-server-runtime/http/mcp-http-server.ts
git commit -m "$(cat <<'EOF'
feat(api): integrate REST API router into HTTP server

API routes are now protected by the same auth middleware as /mcp.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2: SSE Event Bridge

### Task 2.1: Create EventBridge Service [PENDING]

**Files:**
- Create: `apps/electron/src/main/modules/mcp-server-runtime/event-bridge.ts`
- Test: `apps/electron/src/main/modules/mcp-server-runtime/__tests__/event-bridge.test.ts`

**Step 1: Create test file**

```typescript
// apps/electron/src/main/modules/mcp-server-runtime/__tests__/event-bridge.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBridge, EventType } from '../event-bridge';

describe('EventBridge', () => {
  let eventBridge: EventBridge;

  beforeEach(() => {
    eventBridge = new EventBridge();
  });

  afterEach(() => {
    eventBridge.destroy();
  });

  describe('subscribe/unsubscribe', () => {
    it('adds and removes subscribers', () => {
      const callback = vi.fn();
      const unsubscribe = eventBridge.subscribe(callback);
      expect(eventBridge.getSubscriberCount()).toBe(1);
      unsubscribe();
      expect(eventBridge.getSubscriberCount()).toBe(0);
    });
  });

  describe('emit', () => {
    it('broadcasts events to all subscribers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      eventBridge.subscribe(callback1);
      eventBridge.subscribe(callback2);

      eventBridge.emit('servers_updated', { action: 'start', serverId: '123' });

      expect(callback1).toHaveBeenCalledWith({
        type: 'servers_updated',
        data: { action: 'start', serverId: '123' },
        timestamp: expect.any(String),
      });
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('heartbeat', () => {
    it('starts and stops heartbeat', () => {
      vi.useFakeTimers();
      const callback = vi.fn();
      eventBridge.subscribe(callback);
      eventBridge.startHeartbeat(1000);

      vi.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'heartbeat' })
      );

      eventBridge.stopHeartbeat();
      vi.advanceTimersByTime(2000);
      expect(callback).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @mcp_router/electron test -- event-bridge.test.ts`
Expected: FAIL - module not found

**Step 3: Create event-bridge.ts**

```typescript
// apps/electron/src/main/modules/mcp-server-runtime/event-bridge.ts

export type EventType =
  | 'heartbeat'
  | 'hub_state'
  | 'servers_updated'
  | 'tool_list_changed'
  | 'resource_list_changed'
  | 'config_changed';

export interface BridgeEvent {
  type: EventType;
  data: Record<string, unknown>;
  timestamp: string;
}

type EventCallback = (event: BridgeEvent) => void;

export class EventBridge {
  private subscribers: Set<EventCallback> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  subscribe(callback: EventCallback): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  emit(type: EventType, data: Record<string, unknown> = {}): void {
    const event: BridgeEvent = {
      type,
      data,
      timestamp: new Date().toISOString(),
    };
    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('[EventBridge] Subscriber error:', error);
      }
    });
  }

  startHeartbeat(intervalMs: number = 30000): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.emit('heartbeat', { subscriberCount: this.subscribers.size });
    }, intervalMs);
  }

  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  getSubscriberCount(): number {
    return this.subscribers.size;
  }

  destroy(): void {
    this.stopHeartbeat();
    this.subscribers.clear();
  }
}

// Singleton instance
let eventBridgeInstance: EventBridge | null = null;

export function getEventBridge(): EventBridge {
  if (!eventBridgeInstance) {
    eventBridgeInstance = new EventBridge();
  }
  return eventBridgeInstance;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @mcp_router/electron test -- event-bridge.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/electron/src/main/modules/mcp-server-runtime/event-bridge.ts
git add apps/electron/src/main/modules/mcp-server-runtime/__tests__/event-bridge.test.ts
git commit -m "$(cat <<'EOF'
feat(events): add EventBridge service for SSE broadcasting

Supports heartbeat, hub_state, servers_updated, tool_list_changed,
resource_list_changed, and config_changed event types.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.2: Add SSE Events Endpoint [PENDING]

**Files:**
- Modify: `apps/electron/src/main/modules/mcp-server-runtime/http/api-router.ts`

**Step 1: Add SSE events endpoint to api-router.ts**

Add after the `/servers/:id/tools` endpoint:

```typescript
import { getEventBridge } from '../event-bridge';

// Inside createApiRouter function, add:

  // GET /api/events - SSE event stream
  router.get('/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const eventBridge = getEventBridge();

    const sendEvent = (event: { type: string; data: Record<string, unknown>; timestamp: string }) => {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    // Send initial connection event
    sendEvent({
      type: 'connected',
      data: { message: 'SSE connection established' },
      timestamp: new Date().toISOString(),
    });

    // Subscribe to events
    const unsubscribe = eventBridge.subscribe(sendEvent);

    // Start heartbeat if this is first subscriber
    if (eventBridge.getSubscriberCount() === 1) {
      eventBridge.startHeartbeat(30000);
    }

    // Cleanup on disconnect
    req.on('close', () => {
      unsubscribe();
      if (eventBridge.getSubscriberCount() === 0) {
        eventBridge.stopHeartbeat();
      }
    });
  });
```

**Step 2: Add test for SSE endpoint**

```typescript
  describe('GET /api/events', () => {
    it('returns SSE headers', async () => {
      const res = await request(app)
        .get('/api/events')
        .buffer(false);

      expect(res.headers['content-type']).toContain('text/event-stream');
      res.destroy(); // Close connection
    });
  });
```

**Step 3: Run tests**

Run: `pnpm --filter @mcp_router/electron test -- api-router.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/electron/src/main/modules/mcp-server-runtime/http/api-router.ts
git commit -m "$(cat <<'EOF'
feat(events): add GET /api/events SSE endpoint

Streams real-time events from EventBridge to connected clients.
Includes automatic heartbeat management.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.3: Connect IPC Events to EventBridge [PENDING]

**Files:**
- Modify: `apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ipc.ts`

**Step 1: Import EventBridge**

Add at top of file:

```typescript
import { getEventBridge } from '../mcp-server-runtime/event-bridge';
```

**Step 2: Emit events after IPC operations**

Modify each handler to emit events after successful operations:

```typescript
  ipcMain.handle("mcp:start", async (_, id: string) => {
    const mcpServerManager = getMCPServerManager();
    const result = await mcpServerManager.startServer(id, "MCP Router UI");
    getEventBridge().emit('servers_updated', { action: 'start', serverId: id, result });
    return result;
  });

  ipcMain.handle("mcp:stop", (_, id: string) => {
    const mcpServerManager = getMCPServerManager();
    const result = mcpServerManager.stopServer(id, "MCP Router UI");
    getEventBridge().emit('servers_updated', { action: 'stop', serverId: id, result });
    return result;
  });

  ipcMain.handle("mcp:add", async (_, input: CreateServerInput) => {
    // ... existing code ...
    getEventBridge().emit('servers_updated', { action: 'add', serverId: server.id });
    return server;
  });

  ipcMain.handle("mcp:remove", (_, id: string) => {
    const mcpServerManager = getMCPServerManager();
    const result = mcpServerManager.removeServer(id);
    getEventBridge().emit('servers_updated', { action: 'remove', serverId: id });
    return result;
  });

  ipcMain.handle("mcp:update-tool-permissions", (_, id: string, permissions: Record<string, boolean>) => {
    const mcpServerManager = getMCPServerManager();
    const result = mcpServerManager.updateServerToolPermissions(id, permissions);
    getEventBridge().emit('tool_list_changed', { serverId: id, permissions });
    return result;
  });
```

**Step 3: Verify build**

Run: `pnpm --filter @mcp_router/electron build`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ipc.ts
git commit -m "$(cat <<'EOF'
feat(events): emit EventBridge events from IPC handlers

Server lifecycle and tool permission changes now broadcast to SSE clients.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3: MCP Marketplace Integration

### Task 3.1: Create Marketplace Service [PENDING]

**Files:**
- Create: `apps/electron/src/main/modules/marketplace/marketplace.service.ts`
- Create: `apps/electron/src/main/modules/marketplace/marketplace.types.ts`
- Test: `apps/electron/src/main/modules/marketplace/__tests__/marketplace.service.test.ts`

**Step 1: Create types file**

```typescript
// apps/electron/src/main/modules/marketplace/marketplace.types.ts

export interface RegistryServer {
  name: string;
  description: string;
  version: string;
  title?: string;
  websiteUrl?: string;
  repository?: {
    url: string;
    source: string;
  };
  icons?: Array<{
    src: string;
    mimeType?: string;
  }>;
  packages?: Array<{
    registryType: 'npm' | 'pypi' | 'oci';
    identifier: string;
    runtimeHint?: string;
    transport: {
      type: 'stdio' | 'sse' | 'streamable-http';
    };
  }>;
}

export interface RegistryResponse {
  servers: Array<{
    server: RegistryServer;
    _meta: {
      'io.modelcontextprotocol.registry/official': {
        status: string;
        publishedAt: string;
        isLatest: boolean;
      };
    };
  }>;
  metadata: {
    nextCursor: string | null;
    count: number;
  };
}

export interface MarketplaceSearchOptions {
  search?: string;
  limit?: number;
  cursor?: string;
}
```

**Step 2: Create test file**

```typescript
// apps/electron/src/main/modules/marketplace/__tests__/marketplace.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketplaceService } from '../marketplace.service';

// Mock fetch
global.fetch = vi.fn();

describe('MarketplaceService', () => {
  let service: MarketplaceService;

  beforeEach(() => {
    service = new MarketplaceService();
    vi.clearAllMocks();
  });

  describe('searchServers', () => {
    it('fetches servers from registry', async () => {
      const mockResponse = {
        servers: [{ server: { name: 'test-server', description: 'Test' } }],
        metadata: { nextCursor: null, count: 1 },
      };
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.searchServers({ search: 'test' });

      expect(result.servers).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=test'),
        expect.any(Object)
      );
    });

    it('returns cached results within TTL', async () => {
      const mockResponse = {
        servers: [{ server: { name: 'cached', description: 'Cached' } }],
        metadata: { nextCursor: null, count: 1 },
      };
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await service.searchServers({ search: 'cached' });
      await service.searchServers({ search: 'cached' });

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
```

**Step 3: Run test to verify it fails**

Run: `pnpm --filter @mcp_router/electron test -- marketplace.service.test.ts`
Expected: FAIL - module not found

**Step 4: Create marketplace service**

```typescript
// apps/electron/src/main/modules/marketplace/marketplace.service.ts
import type { RegistryResponse, RegistryServer, MarketplaceSearchOptions } from './marketplace.types';

const REGISTRY_BASE = 'https://registry.modelcontextprotocol.io';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
  data: RegistryResponse;
  timestamp: number;
}

export class MarketplaceService {
  private cache: Map<string, CacheEntry> = new Map();

  async searchServers(options: MarketplaceSearchOptions = {}): Promise<RegistryResponse> {
    const cacheKey = JSON.stringify(options);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    const params = new URLSearchParams();
    if (options.search) params.set('search', options.search);
    if (options.limit) params.set('limit', String(options.limit));
    if (options.cursor) params.set('cursor', options.cursor);
    params.set('version', 'latest');

    const response = await fetch(`${REGISTRY_BASE}/v0.1/servers?${params}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Registry API error: ${response.status}`);
    }

    const data = await response.json() as RegistryResponse;
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  async getServerDetails(serverName: string): Promise<RegistryServer | null> {
    const response = await fetch(
      `${REGISTRY_BASE}/v0.1/servers/${encodeURIComponent(serverName)}/versions/latest`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Registry API error: ${response.status}`);
    }

    return response.json();
  }

  async fetchReadme(repoUrl: string): Promise<string | null> {
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return null;

    const [, owner, repo] = match;
    const branches = ['main', 'master'];

    for (const branch of branches) {
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`;
      try {
        const response = await fetch(url);
        if (response.ok) return response.text();
      } catch {
        continue;
      }
    }
    return null;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// Singleton
let instance: MarketplaceService | null = null;

export function getMarketplaceService(): MarketplaceService {
  if (!instance) {
    instance = new MarketplaceService();
  }
  return instance;
}
```

**Step 5: Run test to verify it passes**

Run: `pnpm --filter @mcp_router/electron test -- marketplace.service.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/electron/src/main/modules/marketplace/
git commit -m "$(cat <<'EOF'
feat(marketplace): add MCP Registry integration service

Integrates with official registry at registry.modelcontextprotocol.io.
Includes caching (1hr TTL) and README fetching from GitHub.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.2: Add Marketplace IPC Handlers [PENDING]

**Files:**
- Create: `apps/electron/src/main/modules/marketplace/marketplace.ipc.ts`
- Modify: `apps/electron/src/main/infrastructure/ipc.ts`

**Step 1: Create IPC handlers**

```typescript
// apps/electron/src/main/modules/marketplace/marketplace.ipc.ts
import { ipcMain } from 'electron';
import { getMarketplaceService } from './marketplace.service';
import type { MarketplaceSearchOptions } from './marketplace.types';

export function setupMarketplaceHandlers(): void {
  const service = getMarketplaceService();

  ipcMain.handle('marketplace:search', async (_, options: MarketplaceSearchOptions) => {
    return service.searchServers(options);
  });

  ipcMain.handle('marketplace:details', async (_, serverName: string) => {
    return service.getServerDetails(serverName);
  });

  ipcMain.handle('marketplace:readme', async (_, repoUrl: string) => {
    return service.fetchReadme(repoUrl);
  });

  ipcMain.handle('marketplace:clearCache', async () => {
    service.clearCache();
    return { success: true };
  });
}
```

**Step 2: Register in main IPC setup**

In `apps/electron/src/main/infrastructure/ipc.ts`, add:

```typescript
import { setupMarketplaceHandlers } from '../modules/marketplace/marketplace.ipc';

// In the setup function:
setupMarketplaceHandlers();
```

**Step 3: Verify build**

Run: `pnpm --filter @mcp_router/electron build`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add apps/electron/src/main/modules/marketplace/marketplace.ipc.ts
git add apps/electron/src/main/infrastructure/ipc.ts
git commit -m "$(cat <<'EOF'
feat(marketplace): add IPC handlers for marketplace operations

Exposes marketplace:search, marketplace:details, marketplace:readme,
and marketplace:clearCache to renderer process.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.3: Add Marketplace REST Endpoints [PENDING]

**Files:**
- Modify: `apps/electron/src/main/modules/mcp-server-runtime/http/api-router.ts`

**Step 1: Add marketplace endpoints**

```typescript
import { getMarketplaceService } from '../../marketplace/marketplace.service';

// Add to createApiRouter:

  // GET /api/marketplace - Search marketplace
  router.get('/marketplace', async (req: Request, res: Response) => {
    try {
      const service = getMarketplaceService();
      const options = {
        search: req.query.search as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        cursor: req.query.cursor as string,
      };
      const result = await service.searchServers(options);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Marketplace search failed',
      });
    }
  });

  // GET /api/marketplace/:serverName - Get server details
  router.get('/marketplace/:serverName', async (req: Request, res: Response) => {
    try {
      const service = getMarketplaceService();
      const details = await service.getServerDetails(req.params.serverName);
      if (!details) {
        res.status(404).json({ error: 'Server not found' });
        return;
      }
      res.json(details);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get server details',
      });
    }
  });
```

**Step 2: Verify build**

Run: `pnpm --filter @mcp_router/electron build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add apps/electron/src/main/modules/mcp-server-runtime/http/api-router.ts
git commit -m "$(cat <<'EOF'
feat(marketplace): add REST endpoints for marketplace

GET /api/marketplace and GET /api/marketplace/:serverName endpoints
enable external clients to browse the MCP registry.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4: Hot Reload / Dev Mode

### Task 4.1: Create Dev Mode Watcher Service [PENDING]

**Files:**
- Create: `apps/electron/src/main/modules/mcp-server-manager/dev-watcher.service.ts`
- Test: `apps/electron/src/main/modules/mcp-server-manager/__tests__/dev-watcher.service.test.ts`

**Step 1: Install chokidar**

Run: `pnpm --filter @mcp_router/electron add chokidar`

**Step 2: Create test file**

```typescript
// apps/electron/src/main/modules/mcp-server-manager/__tests__/dev-watcher.service.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DevWatcherService } from '../dev-watcher.service';

vi.mock('chokidar', () => ({
  watch: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('DevWatcherService', () => {
  let service: DevWatcherService;
  let mockRestartCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockRestartCallback = vi.fn();
    service = new DevWatcherService(mockRestartCallback);
  });

  afterEach(async () => {
    await service.stopAll();
  });

  describe('startWatching', () => {
    it('creates watcher for server with dev config', async () => {
      const serverId = 'test-server';
      const patterns = ['src/**/*.ts'];

      await service.startWatching(serverId, patterns, '/project');

      expect(service.isWatching(serverId)).toBe(true);
    });
  });

  describe('stopWatching', () => {
    it('removes watcher for server', async () => {
      await service.startWatching('test', ['*.ts'], '/project');
      await service.stopWatching('test');

      expect(service.isWatching('test')).toBe(false);
    });
  });
});
```

**Step 3: Run test to verify it fails**

Run: `pnpm --filter @mcp_router/electron test -- dev-watcher.service.test.ts`
Expected: FAIL - module not found

**Step 4: Create dev watcher service**

```typescript
// apps/electron/src/main/modules/mcp-server-manager/dev-watcher.service.ts
import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';

export interface DevConfig {
  enabled: boolean;
  watch: string[];
  cwd?: string;
}

type RestartCallback = (serverId: string) => Promise<void>;

export class DevWatcherService {
  private watchers: Map<string, FSWatcher> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private restartCallback: RestartCallback;
  private debounceMs: number;

  constructor(restartCallback: RestartCallback, debounceMs: number = 500) {
    this.restartCallback = restartCallback;
    this.debounceMs = debounceMs;
  }

  async startWatching(
    serverId: string,
    patterns: string[],
    cwd: string
  ): Promise<void> {
    // Stop existing watcher if any
    await this.stopWatching(serverId);

    const absolutePatterns = patterns.map(p =>
      path.isAbsolute(p) ? p : path.join(cwd, p)
    );

    const watcher = chokidar.watch(absolutePatterns, {
      ignoreInitial: true,
      cwd,
      persistent: true,
    });

    watcher.on('change', (filePath) => {
      this.handleChange(serverId, filePath);
    });

    watcher.on('add', (filePath) => {
      this.handleChange(serverId, filePath);
    });

    watcher.on('unlink', (filePath) => {
      this.handleChange(serverId, filePath);
    });

    this.watchers.set(serverId, watcher);
    console.log(`[DevWatcher] Started watching ${patterns.length} patterns for ${serverId}`);
  }

  private handleChange(serverId: string, filePath: string): void {
    console.log(`[DevWatcher] File changed: ${filePath} for server ${serverId}`);

    // Debounce restarts
    const existingTimer = this.debounceTimers.get(serverId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(serverId);
      console.log(`[DevWatcher] Triggering restart for ${serverId}`);
      try {
        await this.restartCallback(serverId);
      } catch (error) {
        console.error(`[DevWatcher] Restart failed for ${serverId}:`, error);
      }
    }, this.debounceMs);

    this.debounceTimers.set(serverId, timer);
  }

  async stopWatching(serverId: string): Promise<void> {
    const watcher = this.watchers.get(serverId);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(serverId);
      console.log(`[DevWatcher] Stopped watching ${serverId}`);
    }

    const timer = this.debounceTimers.get(serverId);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(serverId);
    }
  }

  async stopAll(): Promise<void> {
    const serverIds = Array.from(this.watchers.keys());
    await Promise.all(serverIds.map(id => this.stopWatching(id)));
  }

  isWatching(serverId: string): boolean {
    return this.watchers.has(serverId);
  }

  getWatchedServers(): string[] {
    return Array.from(this.watchers.keys());
  }
}
```

**Step 5: Run test to verify it passes**

Run: `pnpm --filter @mcp_router/electron test -- dev-watcher.service.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/electron/src/main/modules/mcp-server-manager/dev-watcher.service.ts
git add apps/electron/src/main/modules/mcp-server-manager/__tests__/dev-watcher.service.test.ts
git add pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(dev): add DevWatcherService for hot reload

Uses chokidar to watch file patterns and trigger server restarts.
Includes debouncing to prevent rapid restart cycles.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4.2: Add Dev Config to Server Schema [PENDING]

**Files:**
- Modify: `packages/shared/src/types/mcp-server.ts` (or wherever MCPServerConfig is defined)

**Step 1: Add dev config to server type**

```typescript
export interface MCPServerConfig {
  // ... existing fields ...

  /** Development mode configuration for hot reload */
  dev?: {
    /** Enable dev mode with file watching */
    enabled: boolean;
    /** Glob patterns to watch for changes */
    watch: string[];
    /** Working directory for relative patterns */
    cwd?: string;
  };
}
```

**Step 2: Verify types build**

Run: `pnpm --filter @mcp_router/shared build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add packages/shared/
git commit -m "$(cat <<'EOF'
feat(types): add dev config to MCPServerConfig

Enables hot reload configuration per server with watch patterns.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4.3: Integrate Dev Watcher with Server Manager [PENDING]

**Files:**
- Modify: `apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ts`

**Step 1: Add DevWatcherService integration**

Add import and initialization:

```typescript
import { DevWatcherService } from './dev-watcher.service';

// In MCPServerManager class:
private devWatcher: DevWatcherService;

constructor() {
  // ... existing init ...
  this.devWatcher = new DevWatcherService(async (serverId) => {
    console.log(`[MCPServerManager] Hot reloading server ${serverId}`);
    await this.restartServer(serverId);
  });
}
```

**Step 2: Start watcher when server starts with dev config**

In `startServer` method, after successful start:

```typescript
// Check for dev mode
const server = this.getServer(serverId);
if (server?.dev?.enabled && server.dev.watch?.length > 0) {
  const cwd = server.dev.cwd || server.cwd || process.cwd();
  await this.devWatcher.startWatching(serverId, server.dev.watch, cwd);
}
```

**Step 3: Stop watcher when server stops**

In `stopServer` method:

```typescript
await this.devWatcher.stopWatching(serverId);
```

**Step 4: Add restartServer method if not exists**

```typescript
async restartServer(serverId: string): Promise<void> {
  const server = this.getServer(serverId);
  if (!server) {
    throw new Error(`Server ${serverId} not found`);
  }

  this.stopServer(serverId, 'DevWatcher');
  await this.startServer(serverId, 'DevWatcher');
}
```

**Step 5: Verify build**

Run: `pnpm --filter @mcp_router/electron build`
Expected: SUCCESS

**Step 6: Commit**

```bash
git add apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ts
git commit -m "$(cat <<'EOF'
feat(dev): integrate DevWatcher with MCPServerManager

Servers with dev.enabled=true now auto-restart on file changes.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5: Structured Logging

### Task 5.1: Add Pino and Create Logger Factory [PENDING]

**Files:**
- Create: `apps/electron/src/main/utils/logger-factory.ts`

**Step 1: Install pino**

Run: `pnpm --filter @mcp_router/electron add pino pino-pretty`

**Step 2: Create logger factory**

```typescript
// apps/electron/src/main/utils/logger-factory.ts
import pino from 'pino';
import path from 'path';
import os from 'os';
import fs from 'fs';

function getLogDirectory(): string {
  const xdgStateHome = process.env.XDG_STATE_HOME ||
    path.join(os.homedir(), '.local', 'state');
  const logDir = path.join(xdgStateHome, 'mcp-router', 'logs');

  // Ensure directory exists
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  return logDir;
}

function getLogFilePath(): string {
  const logDir = getLogDirectory();
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(logDir, `mcp-router-${date}.log`);
}

const isDev = process.env.NODE_ENV === 'development';

const logger = pino({
  level: isDev ? 'debug' : 'info',
  transport: isDev ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  } : undefined,
  base: {
    app: 'mcp-router',
    version: process.env.npm_package_version,
  },
});

// In production, also write to file
if (!isDev) {
  const logFile = getLogFilePath();
  const fileStream = fs.createWriteStream(logFile, { flags: 'a' });

  // Create multi-destination transport
  const multiLogger = pino({
    level: 'info',
    base: {
      app: 'mcp-router',
      version: process.env.npm_package_version,
    },
  }, pino.multistream([
    { stream: process.stdout },
    { stream: fileStream },
  ]));

  // Export file logger in production
  module.exports = { logger: multiLogger, getLogDirectory };
}

export { logger, getLogDirectory };
```

**Step 3: Commit**

```bash
git add apps/electron/src/main/utils/logger-factory.ts
git add pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(logging): add Pino logger factory with XDG-compliant file output

- Development: pretty console output
- Production: JSON to console + daily log file

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5.2: Update utils/logger to Use Pino [PENDING]

**Files:**
- Modify: `apps/electron/src/main/utils/logger.ts`

**Step 1: Replace console-based logging with Pino**

```typescript
// apps/electron/src/main/utils/logger.ts
import { logger } from './logger-factory';

/**
 * INFO level log
 */
export function logInfo(...args: unknown[]): void {
  if (args.length === 1) {
    logger.info(args[0]);
  } else {
    logger.info({ data: args }, String(args[0]));
  }
}

/**
 * ERROR level log
 */
export function logError(...args: unknown[]): void {
  if (args.length === 1 && args[0] instanceof Error) {
    logger.error({ err: args[0] }, args[0].message);
  } else if (args.length === 1) {
    logger.error(args[0]);
  } else {
    logger.error({ data: args }, String(args[0]));
  }
}

/**
 * WARN level log
 */
export function logWarn(...args: unknown[]): void {
  if (args.length === 1) {
    logger.warn(args[0]);
  } else {
    logger.warn({ data: args }, String(args[0]));
  }
}

/**
 * DEBUG level log
 */
export function logDebug(...args: unknown[]): void {
  if (args.length === 1) {
    logger.debug(args[0]);
  } else {
    logger.debug({ data: args }, String(args[0]));
  }
}

// Export logger for direct use
export { logger };
```

**Step 2: Verify build**

Run: `pnpm --filter @mcp_router/electron build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add apps/electron/src/main/utils/logger.ts
git commit -m "$(cat <<'EOF'
feat(logging): update logger utilities to use Pino

Adds logWarn and logDebug. All logs now structured JSON in production.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5.3: Add Log Retention Cleanup [PENDING]

**Files:**
- Create: `apps/electron/src/main/utils/log-cleanup.ts`
- Modify: `apps/electron/src/main.ts`

**Step 1: Create cleanup utility**

```typescript
// apps/electron/src/main/utils/log-cleanup.ts
import fs from 'fs';
import path from 'path';
import { getLogDirectory } from './logger-factory';
import { logger } from './logger-factory';

const RETENTION_DAYS = 30;

export async function cleanupOldLogs(): Promise<void> {
  const logDir = getLogDirectory();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  try {
    const files = await fs.promises.readdir(logDir);

    for (const file of files) {
      if (!file.startsWith('mcp-router-') || !file.endsWith('.log')) {
        continue;
      }

      const filePath = path.join(logDir, file);
      const stats = await fs.promises.stat(filePath);

      if (stats.mtime < cutoffDate) {
        await fs.promises.unlink(filePath);
        logger.info({ file }, 'Deleted old log file');
      }
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to cleanup old logs');
  }
}
```

**Step 2: Schedule cleanup on app start**

In `main.ts`, add after app initialization:

```typescript
import { cleanupOldLogs } from './main/utils/log-cleanup';

// After app is ready:
cleanupOldLogs().catch(err => console.error('Log cleanup failed:', err));
```

**Step 3: Verify build**

Run: `pnpm --filter @mcp_router/electron build`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add apps/electron/src/main/utils/log-cleanup.ts
git add apps/electron/src/main.ts
git commit -m "$(cat <<'EOF'
feat(logging): add 30-day log retention cleanup

Runs on app startup, deletes logs older than 30 days.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6: Final Integration & Documentation

### Task 6.1: Run Full Test Suite [PENDING]

**Step 1: Run all tests**

Run: `pnpm test`
Expected: All tests PASS

**Step 2: Run type check**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Run linter**

Run: `pnpm lint:fix`
Expected: No errors (or auto-fixed)

**Step 4: Run knip**

Run: `pnpm knip`
Expected: No unused exports flagged for new code

---

### Task 6.2: Update Documentation [PENDING]

**Files:**
- Modify: `docs/adr/` - Add ADR for QoL features

**Step 1: Create ADR**

```markdown
# ADR: Quality of Life Features

## Status
Accepted

## Context
MCP Router needed feature parity with mcp-hub for developer experience.

## Decision
Implemented 5 QoL features:
1. REST API - Extends MCPHttpServer with /api/* endpoints
2. SSE Events - EventBridge service broadcasts IPC events to SSE clients
3. Marketplace - Integrates official MCP Registry API
4. Hot Reload - DevWatcherService uses chokidar for file watching
5. Structured Logging - Pino with XDG-compliant file output

## Consequences
- External clients can now manage servers via REST API
- Real-time updates available via SSE
- Server discovery from official registry
- Improved developer experience for MCP server development
- Production-ready logging with retention
```

**Step 2: Commit**

```bash
git add docs/
git commit -m "$(cat <<'EOF'
docs: add ADR for QoL features implementation

Documents REST API, SSE Events, Marketplace, Hot Reload, and Logging.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

| Phase | Feature | Tasks | Estimated Commits |
|-------|---------|-------|-------------------|
| 1 | REST API | 2 | 2 |
| 2 | SSE Events | 3 | 3 |
| 3 | Marketplace | 3 | 3 |
| 4 | Hot Reload | 3 | 3 |
| 5 | Logging | 3 | 3 |
| 6 | Integration | 2 | 1 |

**Total: 16 tasks, 15 commits**

---

## Dependencies Added

```bash
pnpm --filter @mcp_router/electron add chokidar pino pino-pretty
```

## New Files Created

```
apps/electron/src/main/modules/mcp-server-runtime/http/api-router.ts
apps/electron/src/main/modules/mcp-server-runtime/event-bridge.ts
apps/electron/src/main/modules/marketplace/marketplace.service.ts
apps/electron/src/main/modules/marketplace/marketplace.types.ts
apps/electron/src/main/modules/marketplace/marketplace.ipc.ts
apps/electron/src/main/modules/mcp-server-manager/dev-watcher.service.ts
apps/electron/src/main/utils/logger-factory.ts
apps/electron/src/main/utils/log-cleanup.ts
```
