import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { ConnectionMonitor, ConnectionState } from "./connection-monitor";
import { HealthChecker } from "./health-checker";
import { safeConsoleLog, safeConsoleError } from "@/main/utils/safe-console";

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
  private readonly maxRetries: number;
  private readonly initialDelayMs: number;
  private readonly maxDelayMs: number;

  constructor(options: ReconnectingClientOptions) {
    this.serverId = options.serverId;
    this.serverName = options.serverName;
    this.createTransport = options.createTransport;
    this.onStatusChange = options.onStatusChange;
    this.healthCheckUrl = options.healthCheckUrl;
    this.healthCheckIntervalMs = options.healthCheckIntervalMs ?? 30000;
    this.bearerToken = options.bearerToken;
    this.maxRetries = options.maxRetries ?? 5;
    this.initialDelayMs = options.initialDelayMs ?? 1000;
    this.maxDelayMs = options.maxDelayMs ?? 30000;

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
      maxRetries: this.maxRetries,
      initialDelayMs: this.initialDelayMs,
      maxDelayMs: this.maxDelayMs,
    });
  }

  async connect(): Promise<void> {
    if (this.disposed) {
      throw new Error("Client has been disposed");
    }

    this.monitor.markConnecting();

    // Try initial connection with retries
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (this.disposed) {
        throw new Error("Client has been disposed");
      }

      try {
        this.transport = this.createTransport();
        this.setupTransportCallbacks(this.transport);
        await this.client.connect(this.transport);

        // Success
        this.monitor.markConnected();
        this.startHealthChecker();
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.maxRetries) {
          // Calculate delay with exponential backoff
          const delay = Math.min(
            this.initialDelayMs * Math.pow(2, attempt),
            this.maxDelayMs,
          );

          safeConsoleLog(
            `[ReconnectingMCPClient] Initial connection to ${this.serverName} failed (attempt ${attempt + 1}/${this.maxRetries + 1}), retrying in ${delay}ms...`,
          );

          // Emit reconnecting state so UI shows retry progress
          this.onStatusChange("reconnecting");

          // Wait before retry
          await this.sleep(delay);

          // Recreate client for fresh connection attempt
          try {
            await this.client.close();
          } catch {
            // Ignore close errors
          }
          this.client = new Client({
            name: "mcp-router",
            version: "1.0.0",
          });
        }
      }
    }

    // All retries exhausted
    safeConsoleError(
      `[ReconnectingMCPClient] Failed to connect to ${this.serverName} after ${this.maxRetries + 1} attempts`,
    );
    this.onStatusChange("failed");
    throw lastError ?? new Error("Connection failed after all retries");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
      safeConsoleError(
        `[ReconnectingMCPClient] Error closing client ${this.serverId}:`,
        error,
      );
    }
  }

  private setupTransportCallbacks(transport: Transport): void {
    const originalOnClose = transport.onclose;
    const originalOnError = transport.onerror;

    transport.onclose = () => {
      safeConsoleLog(
        `[ReconnectingMCPClient] Transport closed for ${this.serverName}`,
      );
      originalOnClose?.();
      if (!this.disposed) {
        this.monitor.handleConnectionLost();
      }
    };

    transport.onerror = (error: Error) => {
      safeConsoleError(
        `[ReconnectingMCPClient] Transport error for ${this.serverName}:`,
        error,
      );
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

      // Check again after async operation (race condition guard)
      if (this.disposed) return false;

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
      safeConsoleError(
        `[ReconnectingMCPClient] Reconnect failed for ${this.serverName}:`,
        error,
      );
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
        safeConsoleLog(
          `[ReconnectingMCPClient] Health check passed for ${this.serverName}`,
        );
      },
      onUnhealthy: () => {
        safeConsoleLog(
          `[ReconnectingMCPClient] Health check failed for ${this.serverName}`,
        );
        if (!this.disposed && this.monitor.getState() === "connected") {
          this.monitor.handleConnectionLost();
        }
      },
      failureThreshold: 3,
    });

    this.healthChecker.start();
  }
}
