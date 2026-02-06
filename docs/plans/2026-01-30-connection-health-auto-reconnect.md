# Connection Health Detection & Auto-Reconnect Implementation Plan

> **STATUS: COMPLETED**

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable MCP Router to detect lost connections (SSE/HTTP) and automatically reconnect, updating UI status accordingly.

**Architecture:** Wrap MCP SDK transports with connection monitoring. Use transport `onclose`/`onerror` callbacks to detect failures. Implement exponential backoff reconnection. Update `MCPServer.status` to reflect connection state. Add periodic health pings for HTTP transport.

**Tech Stack:** TypeScript, MCP SDK (`@modelcontextprotocol/sdk`), Electron IPC for UI updates

---

## Overview

Current state:
- No detection when SSE stream closes (laptop sleep, server timeout)
- No detection when HTTP server session expires
- No automatic reconnection on failure
- `MCPServer.status` not updated when connections fail
- User must manually toggle server off/on to recover

Target state:
- Transport `onclose`/`onerror` callbacks trigger reconnection
- Exponential backoff (1s → 2s → 4s → ... max 30s)
- UI shows "reconnecting" status during recovery
- HTTP transport gets periodic health pings
- Graceful handling of permanent failures (max retries)

---

## Task 1: Create ConnectionMonitor Utility Class [DONE]

**Files:**
- Create: `apps/electron/src/main/modules/mcp-server-manager/connection-monitor.ts`
- Test: `apps/electron/src/main/modules/mcp-server-manager/__tests__/connection-monitor.test.ts`

**Step 1: Write the test file**

```typescript
// apps/electron/src/main/modules/mcp-server-manager/__tests__/connection-monitor.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConnectionMonitor, ConnectionState } from "../connection-monitor";

describe("ConnectionMonitor", () => {
  let monitor: ConnectionMonitor;
  let onStateChange: ReturnType<typeof vi.fn>;
  let onReconnect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    onStateChange = vi.fn();
    onReconnect = vi.fn().mockResolvedValue(true);
    monitor = new ConnectionMonitor({
      serverId: "test-server",
      onStateChange,
      onReconnect,
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 1000,
    });
  });

  afterEach(() => {
    monitor.dispose();
    vi.useRealTimers();
  });

  it("should start in disconnected state", () => {
    expect(monitor.getState()).toBe("disconnected");
  });

  it("should transition to connected when markConnected is called", () => {
    monitor.markConnected();
    expect(monitor.getState()).toBe("connected");
    expect(onStateChange).toHaveBeenCalledWith("connected");
  });

  it("should attempt reconnection on connection loss", async () => {
    monitor.markConnected();
    monitor.handleConnectionLost();

    expect(monitor.getState()).toBe("reconnecting");
    expect(onStateChange).toHaveBeenCalledWith("reconnecting");

    // Advance timer to trigger first reconnect attempt
    await vi.advanceTimersByTimeAsync(100);

    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it("should use exponential backoff on failed reconnects", async () => {
    onReconnect.mockResolvedValue(false);
    monitor.markConnected();
    monitor.handleConnectionLost();

    // First attempt after 100ms
    await vi.advanceTimersByTimeAsync(100);
    expect(onReconnect).toHaveBeenCalledTimes(1);

    // Second attempt after 200ms (100 * 2)
    await vi.advanceTimersByTimeAsync(200);
    expect(onReconnect).toHaveBeenCalledTimes(2);

    // Third attempt after 400ms (200 * 2)
    await vi.advanceTimersByTimeAsync(400);
    expect(onReconnect).toHaveBeenCalledTimes(3);
  });

  it("should cap delay at maxDelayMs", async () => {
    onReconnect.mockResolvedValue(false);
    monitor = new ConnectionMonitor({
      serverId: "test",
      onStateChange,
      onReconnect,
      maxRetries: 10,
      initialDelayMs: 500,
      maxDelayMs: 1000,
    });
    monitor.markConnected();
    monitor.handleConnectionLost();

    // First: 500ms
    await vi.advanceTimersByTimeAsync(500);
    // Second: 1000ms (capped, not 1000)
    await vi.advanceTimersByTimeAsync(1000);
    // Third: 1000ms (still capped)
    await vi.advanceTimersByTimeAsync(1000);

    expect(onReconnect).toHaveBeenCalledTimes(3);
  });

  it("should transition to failed after max retries", async () => {
    onReconnect.mockResolvedValue(false);
    monitor.markConnected();
    monitor.handleConnectionLost();

    // Exhaust all retries (3 attempts with backoff: 100, 200, 400)
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(200);
    await vi.advanceTimersByTimeAsync(400);

    expect(monitor.getState()).toBe("failed");
    expect(onStateChange).toHaveBeenLastCalledWith("failed");
  });

  it("should reset retry count on successful reconnect", async () => {
    onReconnect.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    monitor.markConnected();
    monitor.handleConnectionLost();

    await vi.advanceTimersByTimeAsync(100); // First attempt fails
    await vi.advanceTimersByTimeAsync(200); // Second attempt succeeds

    expect(monitor.getState()).toBe("connected");
    expect(monitor.getRetryCount()).toBe(0);
  });

  it("should cancel pending reconnect on dispose", async () => {
    monitor.markConnected();
    monitor.handleConnectionLost();
    monitor.dispose();

    await vi.advanceTimersByTimeAsync(1000);
    expect(onReconnect).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd /Users/robdezendorf/Documents/GitHub/mcp-router && pnpm test apps/electron/src/main/modules/mcp-server-manager/__tests__/connection-monitor.test.ts
```

Expected: FAIL - module not found

**Step 3: Implement ConnectionMonitor**

```typescript
// apps/electron/src/main/modules/mcp-server-manager/connection-monitor.ts
export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting" | "failed";

export interface ConnectionMonitorOptions {
  serverId: string;
  onStateChange: (state: ConnectionState) => void;
  onReconnect: () => Promise<boolean>;
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
}

export class ConnectionMonitor {
  private state: ConnectionState = "disconnected";
  private retryCount = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private disposed = false;

  private readonly serverId: string;
  private readonly onStateChange: (state: ConnectionState) => void;
  private readonly onReconnect: () => Promise<boolean>;
  private readonly maxRetries: number;
  private readonly initialDelayMs: number;
  private readonly maxDelayMs: number;

  constructor(options: ConnectionMonitorOptions) {
    this.serverId = options.serverId;
    this.onStateChange = options.onStateChange;
    this.onReconnect = options.onReconnect;
    this.maxRetries = options.maxRetries ?? 5;
    this.initialDelayMs = options.initialDelayMs ?? 1000;
    this.maxDelayMs = options.maxDelayMs ?? 30000;
  }

  getState(): ConnectionState {
    return this.state;
  }

  getRetryCount(): number {
    return this.retryCount;
  }

  markConnected(): void {
    this.cancelPendingReconnect();
    this.retryCount = 0;
    this.setState("connected");
  }

  markConnecting(): void {
    this.setState("connecting");
  }

  handleConnectionLost(): void {
    if (this.disposed || this.state === "reconnecting" || this.state === "failed") {
      return;
    }
    this.setState("reconnecting");
    this.scheduleReconnect();
  }

  handleError(error: Error): void {
    console.error(`[ConnectionMonitor] Server ${this.serverId} error:`, error.message);
    // Errors don't always mean connection loss, but we should track them
    // Only trigger reconnect if we were connected
    if (this.state === "connected") {
      this.handleConnectionLost();
    }
  }

  dispose(): void {
    this.disposed = true;
    this.cancelPendingReconnect();
  }

  private setState(newState: ConnectionState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.onStateChange(newState);
    }
  }

  private cancelPendingReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private getNextDelay(): number {
    const delay = this.initialDelayMs * Math.pow(2, this.retryCount);
    return Math.min(delay, this.maxDelayMs);
  }

  private scheduleReconnect(): void {
    if (this.disposed) return;

    if (this.retryCount >= this.maxRetries) {
      console.log(`[ConnectionMonitor] Server ${this.serverId} max retries (${this.maxRetries}) reached`);
      this.setState("failed");
      return;
    }

    const delay = this.getNextDelay();
    console.log(`[ConnectionMonitor] Server ${this.serverId} reconnecting in ${delay}ms (attempt ${this.retryCount + 1}/${this.maxRetries})`);

    this.reconnectTimer = setTimeout(async () => {
      if (this.disposed) return;

      this.retryCount++;

      try {
        const success = await this.onReconnect();
        if (success) {
          console.log(`[ConnectionMonitor] Server ${this.serverId} reconnected successfully`);
          this.markConnected();
        } else {
          console.log(`[ConnectionMonitor] Server ${this.serverId} reconnect failed`);
          this.scheduleReconnect();
        }
      } catch (error) {
        console.error(`[ConnectionMonitor] Server ${this.serverId} reconnect error:`, error);
        this.scheduleReconnect();
      }
    }, delay);
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
cd /Users/robdezendorf/Documents/GitHub/mcp-router && pnpm test apps/electron/src/main/modules/mcp-server-manager/__tests__/connection-monitor.test.ts
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add apps/electron/src/main/modules/mcp-server-manager/connection-monitor.ts apps/electron/src/main/modules/mcp-server-manager/__tests__/connection-monitor.test.ts
git commit -m "feat(connection-monitor): add ConnectionMonitor utility with exponential backoff"
```

---

## Task 2: Create HealthChecker for HTTP Transport [DONE]

**Files:**
- Create: `apps/electron/src/main/modules/mcp-server-manager/health-checker.ts`
- Test: `apps/electron/src/main/modules/mcp-server-manager/__tests__/health-checker.test.ts`

**Step 1: Write the test file**

```typescript
// apps/electron/src/main/modules/mcp-server-manager/__tests__/health-checker.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HealthChecker } from "../health-checker";

describe("HealthChecker", () => {
  let checker: HealthChecker;
  let onHealthy: ReturnType<typeof vi.fn>;
  let onUnhealthy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    onHealthy = vi.fn();
    onUnhealthy = vi.fn();
  });

  afterEach(() => {
    checker?.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("should not run until started", async () => {
    const pingFn = vi.fn().mockResolvedValue(true);
    checker = new HealthChecker({
      pingFn,
      intervalMs: 1000,
      onHealthy,
      onUnhealthy,
    });

    await vi.advanceTimersByTimeAsync(5000);
    expect(pingFn).not.toHaveBeenCalled();
  });

  it("should ping at specified interval", async () => {
    const pingFn = vi.fn().mockResolvedValue(true);
    checker = new HealthChecker({
      pingFn,
      intervalMs: 1000,
      onHealthy,
      onUnhealthy,
    });

    checker.start();

    // Initial ping
    await vi.advanceTimersByTimeAsync(0);
    expect(pingFn).toHaveBeenCalledTimes(1);

    // After 1 second
    await vi.advanceTimersByTimeAsync(1000);
    expect(pingFn).toHaveBeenCalledTimes(2);

    // After another second
    await vi.advanceTimersByTimeAsync(1000);
    expect(pingFn).toHaveBeenCalledTimes(3);
  });

  it("should call onUnhealthy after consecutive failures", async () => {
    const pingFn = vi.fn().mockResolvedValue(false);
    checker = new HealthChecker({
      pingFn,
      intervalMs: 1000,
      onHealthy,
      onUnhealthy,
      failureThreshold: 3,
    });

    checker.start();

    // First two failures - no callback yet
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(onUnhealthy).not.toHaveBeenCalled();

    // Third failure triggers callback
    await vi.advanceTimersByTimeAsync(1000);
    expect(onUnhealthy).toHaveBeenCalledTimes(1);
  });

  it("should reset failure count on success", async () => {
    const pingFn = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true) // Success resets count
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValue(false);

    checker = new HealthChecker({
      pingFn,
      intervalMs: 1000,
      onHealthy,
      onUnhealthy,
      failureThreshold: 3,
    });

    checker.start();

    // 2 failures
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    // 1 success (resets)
    await vi.advanceTimersByTimeAsync(1000);
    // 2 more failures (not enough)
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(onUnhealthy).not.toHaveBeenCalled();

    // 3rd consecutive failure
    await vi.advanceTimersByTimeAsync(1000);
    expect(onUnhealthy).toHaveBeenCalledTimes(1);
  });

  it("should call onHealthy when recovering from unhealthy", async () => {
    const pingFn = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false) // Triggers unhealthy
      .mockResolvedValueOnce(true); // Recovery

    checker = new HealthChecker({
      pingFn,
      intervalMs: 1000,
      onHealthy,
      onUnhealthy,
      failureThreshold: 3,
    });

    checker.start();

    // Become unhealthy
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(onUnhealthy).toHaveBeenCalled();

    // Recover
    await vi.advanceTimersByTimeAsync(1000);
    expect(onHealthy).toHaveBeenCalledTimes(1);
  });

  it("should stop pinging when stopped", async () => {
    const pingFn = vi.fn().mockResolvedValue(true);
    checker = new HealthChecker({
      pingFn,
      intervalMs: 1000,
      onHealthy,
      onUnhealthy,
    });

    checker.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(pingFn).toHaveBeenCalledTimes(1);

    checker.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(pingFn).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd /Users/robdezendorf/Documents/GitHub/mcp-router && pnpm test apps/electron/src/main/modules/mcp-server-manager/__tests__/health-checker.test.ts
```

Expected: FAIL - module not found

**Step 3: Implement HealthChecker**

```typescript
// apps/electron/src/main/modules/mcp-server-manager/health-checker.ts
export interface HealthCheckerOptions {
  pingFn: () => Promise<boolean>;
  intervalMs: number;
  onHealthy: () => void;
  onUnhealthy: () => void;
  failureThreshold?: number;
}

export class HealthChecker {
  private timer: NodeJS.Timeout | null = null;
  private consecutiveFailures = 0;
  private isUnhealthy = false;
  private running = false;

  private readonly pingFn: () => Promise<boolean>;
  private readonly intervalMs: number;
  private readonly onHealthy: () => void;
  private readonly onUnhealthy: () => void;
  private readonly failureThreshold: number;

  constructor(options: HealthCheckerOptions) {
    this.pingFn = options.pingFn;
    this.intervalMs = options.intervalMs;
    this.onHealthy = options.onHealthy;
    this.onUnhealthy = options.onUnhealthy;
    this.failureThreshold = options.failureThreshold ?? 3;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.consecutiveFailures = 0;
    this.isUnhealthy = false;
    this.performCheck();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private async performCheck(): Promise<void> {
    if (!this.running) return;

    try {
      const healthy = await this.pingFn();

      if (healthy) {
        this.consecutiveFailures = 0;
        if (this.isUnhealthy) {
          this.isUnhealthy = false;
          this.onHealthy();
        }
      } else {
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= this.failureThreshold && !this.isUnhealthy) {
          this.isUnhealthy = true;
          this.onUnhealthy();
        }
      }
    } catch (error) {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.failureThreshold && !this.isUnhealthy) {
        this.isUnhealthy = true;
        this.onUnhealthy();
      }
    }

    if (this.running) {
      this.timer = setTimeout(() => this.performCheck(), this.intervalMs);
    }
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
cd /Users/robdezendorf/Documents/GitHub/mcp-router && pnpm test apps/electron/src/main/modules/mcp-server-manager/__tests__/health-checker.test.ts
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add apps/electron/src/main/modules/mcp-server-manager/health-checker.ts apps/electron/src/main/modules/mcp-server-manager/__tests__/health-checker.test.ts
git commit -m "feat(health-checker): add periodic health check utility for HTTP connections"
```

---

## Task 3: Create ReconnectingMCPClient Wrapper [DONE]

**Files:**
- Create: `apps/electron/src/main/modules/mcp-server-manager/reconnecting-mcp-client.ts`
- Test: `apps/electron/src/main/modules/mcp-server-manager/__tests__/reconnecting-mcp-client.test.ts`

**Step 1: Write the test file**

```typescript
// apps/electron/src/main/modules/mcp-server-manager/__tests__/reconnecting-mcp-client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ReconnectingMCPClient, ReconnectingClientOptions } from "../reconnecting-mcp-client";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

// Mock the MCP SDK Client
vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue({ tools: [] }),
  })),
}));

describe("ReconnectingMCPClient", () => {
  let client: ReconnectingMCPClient;
  let onStatusChange: ReturnType<typeof vi.fn>;
  let createTransport: ReturnType<typeof vi.fn>;
  let mockTransport: any;

  beforeEach(() => {
    vi.useFakeTimers();
    onStatusChange = vi.fn();

    mockTransport = {
      onclose: undefined,
      onerror: undefined,
    };

    createTransport = vi.fn().mockReturnValue(mockTransport);
  });

  afterEach(() => {
    client?.dispose();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const createClient = (overrides: Partial<ReconnectingClientOptions> = {}) => {
    return new ReconnectingMCPClient({
      serverId: "test-server",
      serverName: "Test Server",
      createTransport,
      onStatusChange,
      maxRetries: 3,
      initialDelayMs: 100,
      ...overrides,
    });
  };

  it("should connect and set up transport callbacks", async () => {
    client = createClient();
    await client.connect();

    expect(createTransport).toHaveBeenCalled();
    expect(mockTransport.onclose).toBeDefined();
    expect(mockTransport.onerror).toBeDefined();
    expect(onStatusChange).toHaveBeenCalledWith("connected");
  });

  it("should trigger reconnection when transport closes", async () => {
    client = createClient();
    await client.connect();

    // Clear previous status changes
    onStatusChange.mockClear();

    // Simulate transport close
    mockTransport.onclose();

    expect(onStatusChange).toHaveBeenCalledWith("reconnecting");
  });

  it("should trigger reconnection when transport errors", async () => {
    client = createClient();
    await client.connect();

    onStatusChange.mockClear();

    // Simulate transport error
    mockTransport.onerror(new Error("Connection lost"));

    expect(onStatusChange).toHaveBeenCalledWith("reconnecting");
  });

  it("should expose underlying client for MCP operations", async () => {
    client = createClient();
    await client.connect();

    const mcpClient = client.getClient();
    expect(mcpClient).toBeDefined();
    expect(mcpClient.listTools).toBeDefined();
  });

  it("should clean up on dispose", async () => {
    client = createClient();
    await client.connect();

    const mcpClient = client.getClient();
    client.dispose();

    expect(mcpClient.close).toHaveBeenCalled();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd /Users/robdezendorf/Documents/GitHub/mcp-router && pnpm test apps/electron/src/main/modules/mcp-server-manager/__tests__/reconnecting-mcp-client.test.ts
```

Expected: FAIL - module not found

**Step 3: Implement ReconnectingMCPClient**

```typescript
// apps/electron/src/main/modules/mcp-server-manager/reconnecting-mcp-client.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { ConnectionMonitor, ConnectionState } from "./connection-monitor";
import { HealthChecker } from "./health-checker";

export interface ReconnectingClientOptions {
  serverId: string;
  serverName: string;
  createTransport: () => Transport;
  onStatusChange: (status: ConnectionState) => void;
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  // For HTTP transport health checking
  healthCheckUrl?: string;
  healthCheckIntervalMs?: number;
  bearerToken?: string;
}

export class ReconnectingMCPClient {
  private client: Client;
  private transport: Transport | null = null;
  private monitor: ConnectionMonitor;
  private healthChecker: HealthChecker | null = null;
  private disposed = false;

  private readonly serverId: string;
  private readonly serverName: string;
  private readonly createTransport: () => Transport;
  private readonly onStatusChange: (status: ConnectionState) => void;
  private readonly healthCheckUrl?: string;
  private readonly healthCheckIntervalMs: number;
  private readonly bearerToken?: string;

  constructor(options: ReconnectingClientOptions) {
    this.serverId = options.serverId;
    this.serverName = options.serverName;
    this.createTransport = options.createTransport;
    this.onStatusChange = options.onStatusChange;
    this.healthCheckUrl = options.healthCheckUrl;
    this.healthCheckIntervalMs = options.healthCheckIntervalMs ?? 30000;
    this.bearerToken = options.bearerToken;

    this.client = new Client({
      name: "mcp-router",
      version: "1.0.0",
    });

    this.monitor = new ConnectionMonitor({
      serverId: options.serverId,
      onStateChange: (state) => {
        this.onStatusChange(state);
      },
      onReconnect: () => this.attemptReconnect(),
      maxRetries: options.maxRetries,
      initialDelayMs: options.initialDelayMs,
      maxDelayMs: options.maxDelayMs,
    });
  }

  async connect(): Promise<void> {
    if (this.disposed) {
      throw new Error("Client has been disposed");
    }

    this.monitor.markConnecting();
    this.transport = this.createTransport();
    this.setupTransportCallbacks(this.transport);

    await this.client.connect(this.transport);
    this.monitor.markConnected();

    // Start health checker for HTTP transports
    this.startHealthChecker();
  }

  getClient(): Client {
    return this.client;
  }

  getState(): ConnectionState {
    return this.monitor.getState();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.healthChecker?.stop();
    this.monitor.dispose();

    try {
      this.client.close();
    } catch (error) {
      console.error(`[ReconnectingMCPClient] Error closing client ${this.serverId}:`, error);
    }
  }

  private setupTransportCallbacks(transport: Transport): void {
    const originalOnClose = transport.onclose;
    const originalOnError = transport.onerror;

    transport.onclose = () => {
      console.log(`[ReconnectingMCPClient] Transport closed for ${this.serverName}`);
      originalOnClose?.();
      if (!this.disposed) {
        this.monitor.handleConnectionLost();
      }
    };

    transport.onerror = (error: Error) => {
      console.error(`[ReconnectingMCPClient] Transport error for ${this.serverName}:`, error);
      originalOnError?.(error);
      if (!this.disposed) {
        this.monitor.handleError(error);
      }
    };
  }

  private async attemptReconnect(): Promise<boolean> {
    if (this.disposed) return false;

    try {
      // Close existing client cleanly
      try {
        await this.client.close();
      } catch {
        // Ignore close errors
      }

      // Create new client and transport
      this.client = new Client({
        name: "mcp-router",
        version: "1.0.0",
      });

      this.transport = this.createTransport();
      this.setupTransportCallbacks(this.transport);

      await this.client.connect(this.transport);

      // Restart health checker
      this.startHealthChecker();

      return true;
    } catch (error) {
      console.error(`[ReconnectingMCPClient] Reconnect failed for ${this.serverName}:`, error);
      return false;
    }
  }

  private startHealthChecker(): void {
    // Only for HTTP transports with health check URL
    if (!this.healthCheckUrl) return;

    this.healthChecker?.stop();

    this.healthChecker = new HealthChecker({
      pingFn: async () => {
        try {
          const headers: Record<string, string> = {};
          if (this.bearerToken) {
            headers["Authorization"] = `Bearer ${this.bearerToken}`;
          }

          const response = await fetch(this.healthCheckUrl!, {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(5000),
          });

          return response.ok;
        } catch {
          return false;
        }
      },
      intervalMs: this.healthCheckIntervalMs,
      onHealthy: () => {
        console.log(`[ReconnectingMCPClient] Health check passed for ${this.serverName}`);
      },
      onUnhealthy: () => {
        console.log(`[ReconnectingMCPClient] Health check failed for ${this.serverName}`);
        if (!this.disposed && this.monitor.getState() === "connected") {
          this.monitor.handleConnectionLost();
        }
      },
      failureThreshold: 3,
    });

    this.healthChecker.start();
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
cd /Users/robdezendorf/Documents/GitHub/mcp-router && pnpm test apps/electron/src/main/modules/mcp-server-manager/__tests__/reconnecting-mcp-client.test.ts
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add apps/electron/src/main/modules/mcp-server-manager/reconnecting-mcp-client.ts apps/electron/src/main/modules/mcp-server-manager/__tests__/reconnecting-mcp-client.test.ts
git commit -m "feat(reconnecting-client): add ReconnectingMCPClient wrapper with auto-reconnect and health checks"
```

---

## Task 4: Integrate ReconnectingMCPClient into MCPServerManager [DONE]

**Files:**
- Modify: `apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ts`

**Step 1: Update MCPServerManager to use ReconnectingMCPClient**

Update the imports and add the new client type:

```typescript
// At the top of mcp-server-manager.ts, add imports:
import { ReconnectingMCPClient } from "./reconnecting-mcp-client";
import { ConnectionState } from "./connection-monitor";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
```

**Step 2: Replace `clients` Map to use ReconnectingMCPClient**

Change the type of the clients map and add connection state tracking:

```typescript
// Change this line:
private clients: Map<string, Client> = new Map();
// To:
private clients: Map<string, ReconnectingMCPClient> = new Map();
```

**Step 3: Update connectToServerWithResult method**

Replace the connection logic to use ReconnectingMCPClient:

```typescript
private async connectToServerWithResult(
  id: string,
): Promise<
  { status: "success"; client: ReconnectingMCPClient } | { status: "error"; error: string }
> {
  const server = this.servers.get(id);
  if (!server) {
    return { status: "error", error: "Server not found" };
  }

  try {
    const createTransport = () => this.createTransportForServer(server);

    // Determine health check URL for HTTP transports
    let healthCheckUrl: string | undefined;
    if (server.serverType === "remote-streamable" && server.remoteUrl) {
      const url = new URL(server.remoteUrl);
      url.pathname = url.pathname.replace(/\/mcp$/, "/api/test");
      healthCheckUrl = url.toString();
    }

    const reconnectingClient = new ReconnectingMCPClient({
      serverId: server.id,
      serverName: server.name,
      createTransport,
      onStatusChange: (state) => this.handleConnectionStateChange(server.id, state),
      healthCheckUrl,
      healthCheckIntervalMs: 30000,
      bearerToken: server.bearerToken,
      maxRetries: 5,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
    });

    await reconnectingClient.connect();

    return { status: "success", client: reconnectingClient };
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
```

**Step 4: Add createTransportForServer helper method**

```typescript
private createTransportForServer(server: MCPServer): any {
  if (server.serverType === "remote-streamable") {
    if (!server.remoteUrl) {
      throw new Error("remoteUrl required for remote-streamable server");
    }
    return new StreamableHTTPClientTransport(
      new URL(server.remoteUrl),
      {
        sessionId: undefined,
        requestInit: {
          headers: {
            authorization: server.bearerToken ? `Bearer ${server.bearerToken}` : "",
          },
        },
      },
    );
  } else if (server.serverType === "remote") {
    if (!server.remoteUrl) {
      throw new Error("remoteUrl required for remote server");
    }
    const headers: Record<string, string> = {
      Accept: "text/event-stream",
    };
    if (server.bearerToken) {
      headers["authorization"] = `Bearer ${server.bearerToken}`;
    }
    return new SSEClientTransport(new URL(server.remoteUrl), {
      eventSourceInit: {
        fetch: (url, init) => fetch(url, { ...init, headers }),
      },
      requestInit: { headers },
    });
  } else if (server.serverType === "local") {
    if (!server.command) {
      throw new Error("command required for local server");
    }
    // Get user shell env
    const { getUserShellEnv } = require("@/main/utils/env-utils");
    const userEnvs = getUserShellEnv();
    const cleanUserEnvs = Object.entries(userEnvs).reduce(
      (acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value as string;
        }
        return acc;
      },
      {} as Record<string, string>,
    );
    const mergedEnv = { ...cleanUserEnvs, ...server.env };

    return new StdioClientTransport({
      command: server.command,
      args: server.args ? substituteArgsParameters(server.args, server.env || {}, server.inputParams || {}) : undefined,
      env: mergedEnv,
    });
  }
  throw new Error(`Unsupported server type: ${server.serverType}`);
}
```

**Step 5: Add connection state change handler**

```typescript
private handleConnectionStateChange(serverId: string, state: ConnectionState): void {
  const server = this.servers.get(serverId);
  if (!server) return;

  // Map ConnectionState to MCPServer status
  switch (state) {
    case "connected":
      server.status = "running";
      server.errorMessage = undefined;
      this.eventEmitter.emit("server-started", serverId);
      break;
    case "connecting":
      server.status = "starting";
      break;
    case "reconnecting":
      server.status = "starting";
      server.errorMessage = "Reconnecting...";
      this.eventEmitter.emit("server-updated", serverId);
      break;
    case "disconnected":
      server.status = "stopped";
      this.eventEmitter.emit("server-stopped", serverId);
      break;
    case "failed":
      server.status = "error";
      server.errorMessage = "Connection failed after max retries";
      this.eventEmitter.emit("server-stopped", serverId);
      break;
  }
}
```

**Step 6: Update stopServer to use dispose**

```typescript
// In stopServer method, change:
client.close();
// To:
client.dispose();
```

**Step 7: Update listServerTools to get underlying client**

```typescript
// In listServerTools method, change:
const response = await client.listTools();
// To:
const response = await client.getClient().listTools();
```

**Step 8: Run the full test suite**

```bash
cd /Users/robdezendorf/Documents/GitHub/mcp-router && pnpm test
```

Expected: All tests pass

**Step 9: Commit**

```bash
git add apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ts
git commit -m "feat(mcp-server-manager): integrate ReconnectingMCPClient for auto-reconnect support"
```

---

## Task 5: Update MCPAggregator to Handle Reconnections [DONE]

**Files:**
- Modify: `apps/cli/src/mcp-aggregator.ts`

**Step 1: Add method to handle client reconnection**

The aggregator needs to be notified when a client reconnects so it can refresh its tool mappings:

```typescript
// Add new method to MCPAggregator class:

/**
 * Handle client reconnection - refresh tool mappings
 */
public async handleClientReconnected(id: string): Promise<void> {
  const serverClient = this.clients.get(id);
  if (!serverClient) {
    console.warn(`[MCPAggregator] Cannot refresh tools - client ${id} not found`);
    return;
  }

  try {
    // Clear old tool mappings for this server
    for (const [toolName, serverId] of this.toolToServerMap) {
      if (serverId === id) {
        this.toolToServerMap.delete(toolName);
      }
    }

    // Fetch fresh tools
    const response = await serverClient.client.listTools();
    if (response && Array.isArray(response.tools)) {
      for (const tool of response.tools) {
        const toolName = this.prefixToolNames
          ? prefixToolName(serverClient.name, tool.name)
          : tool.name;
        this.toolToServerMap.set(toolName, id);
      }
    }

    console.log(`[MCPAggregator] Refreshed tools for reconnected client ${serverClient.name}`);
  } catch (error) {
    console.error(`[MCPAggregator] Failed to refresh tools for ${serverClient.name}:`, error);
  }
}
```

**Step 2: Run tests**

```bash
cd /Users/robdezendorf/Documents/GitHub/mcp-router && pnpm test apps/cli
```

**Step 3: Commit**

```bash
git add apps/cli/src/mcp-aggregator.ts
git commit -m "feat(mcp-aggregator): add handleClientReconnected method to refresh tool mappings"
```

---

## Task 6: Add UI Status Indicators for Connection State [DONE]

**Files:**
- Modify: `packages/shared/src/types/mcp-types.ts` (if needed)
- Verify: UI components already handle status changes via events

**Step 1: Verify MCPServer status type includes all needed states**

Check that the status type in `mcp-types.ts` includes "reconnecting" or can display it:

```typescript
// In packages/shared/src/types/mcp-types.ts, verify status type:
export interface MCPServer extends MCPServerConfig {
  id: string;
  status: "running" | "starting" | "stopping" | "stopped" | "error";
  // ...
}
```

The existing "starting" status can be reused for "reconnecting" state. The `errorMessage` field can indicate "Reconnecting...".

**Step 2: Commit if changes were needed**

```bash
# Only if changes were made:
git add packages/shared/src/types/mcp-types.ts
git commit -m "feat(types): update MCPServer status type for connection states"
```

---

## Task 7: Manual Integration Testing [PENDING]

**Step 1: Test SSE reconnection**

1. Start MCP Router
2. Connect to an SSE server (e.g., imessage-max)
3. Put laptop to sleep for 5 seconds
4. Wake laptop
5. Verify: Server shows "Reconnecting..." briefly, then "Running"
6. Verify: Tool calls work after reconnect

**Step 2: Test HTTP reconnection**

1. Start MCP Router
2. Connect to an HTTP server
3. Stop the server process manually
4. Wait for health check to detect failure (~90 seconds)
5. Restart the server process
6. Verify: Auto-reconnection happens
7. Verify: Tools work after reconnect

**Step 3: Test max retry failure**

1. Connect to a server
2. Stop the server permanently
3. Verify: After max retries, status shows "Error" with appropriate message
4. Verify: Manual restart still works via UI toggle

---

## Summary

This implementation adds:

1. **ConnectionMonitor** - Tracks connection state, manages exponential backoff reconnection
2. **HealthChecker** - Periodic ping for HTTP transports to detect stale sessions
3. **ReconnectingMCPClient** - Wraps MCP SDK Client with auto-reconnect capability
4. **MCPServerManager integration** - Uses new client wrapper, emits status events
5. **MCPAggregator support** - Refreshes tool mappings after reconnection
6. **UI updates** - Status changes propagate via existing event system

Connection recovery flow:
```
Transport close/error detected
    ↓
ConnectionMonitor.handleConnectionLost()
    ↓
Status → "reconnecting" (UI shows "Starting...")
    ↓
Wait (exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s)
    ↓
Attempt reconnect
    ↓
Success? → Status → "connected" (UI shows "Running")
Failure? → Retry (up to max) or Status → "failed" (UI shows "Error")
```
