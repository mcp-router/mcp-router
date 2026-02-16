interface HealthCheckerOptions {
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
        if (
          this.consecutiveFailures >= this.failureThreshold &&
          !this.isUnhealthy
        ) {
          this.isUnhealthy = true;
          this.onUnhealthy();
        }
      }
    } catch {
      this.consecutiveFailures++;
      if (
        this.consecutiveFailures >= this.failureThreshold &&
        !this.isUnhealthy
      ) {
        this.isUnhealthy = true;
        this.onUnhealthy();
      }
    }

    if (this.running) {
      this.timer = setTimeout(() => this.performCheck(), this.intervalMs);
    }
  }
}
