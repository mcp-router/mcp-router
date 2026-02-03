import { safeConsoleLog, safeConsoleError } from "@/main/utils/logger";

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed";

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
    if (
      this.disposed ||
      this.state === "reconnecting" ||
      this.state === "failed"
    ) {
      return;
    }
    this.setState("reconnecting");
    this.scheduleReconnect();
  }

  handleError(error: Error): void {
    safeConsoleError(
      `[ConnectionMonitor] Server ${this.serverId} error:`,
      error.message,
    );
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
      safeConsoleLog(
        `[ConnectionMonitor] Server ${this.serverId} max retries (${this.maxRetries}) reached`,
      );
      this.setState("failed");
      return;
    }

    const delay = this.getNextDelay();
    safeConsoleLog(
      `[ConnectionMonitor] Server ${this.serverId} reconnecting in ${delay}ms (attempt ${this.retryCount + 1}/${this.maxRetries})`,
    );

    this.reconnectTimer = setTimeout(async () => {
      if (this.disposed) return;

      this.retryCount++;

      try {
        const success = await this.onReconnect();
        if (success) {
          safeConsoleLog(
            `[ConnectionMonitor] Server ${this.serverId} reconnected successfully`,
          );
          this.markConnected();
        } else {
          safeConsoleLog(
            `[ConnectionMonitor] Server ${this.serverId} reconnect failed`,
          );
          this.scheduleReconnect();
        }
      } catch (error) {
        safeConsoleError(
          `[ConnectionMonitor] Server ${this.serverId} reconnect error:`,
          error,
        );
        this.scheduleReconnect();
      }
    }, delay);
  }
}
