/**
 * Token bucket rate limiter for MCP request pipeline.
 *
 * Each "bucket" is identified by a string key (e.g. "client:<id>",
 * "server:<name>", "tool:<server>:<tool>") and independently tracks a token
 * count that refills at a constant rate.
 *
 * Design choices:
 *  - In-memory only (appropriate for a desktop Electron app).
 *  - Lazy refill: tokens are recalculated on each `tryConsume` call rather
 *    than on a timer, so idle keys cost nothing.
 *  - Periodic cleanup of stale buckets to avoid unbounded memory growth.
 */

/** Result of a rate limit check */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** If not allowed, how many ms before the bucket has at least 1 token */
  retryAfterMs?: number;
}

/** Per-key override configuration */
export interface RateLimitOverride {
  maxTokens: number;
  refillRatePerSecond: number;
}

/** Options accepted by the RateLimiter constructor */
export interface RateLimiterOptions {
  /** Maximum tokens (burst size) for the default bucket. Default: 60 */
  maxTokens?: number;
  /** Tokens added per second. Default: 1 (= 60/minute) */
  refillRatePerSecond?: number;
  /**
   * How long (ms) a bucket can sit idle before it is eligible for cleanup.
   * Default: 300_000 (5 minutes).
   */
  staleAfterMs?: number;
  /**
   * How often (ms) the cleanup sweep runs. Default: 60_000 (1 minute).
   */
  cleanupIntervalMs?: number;
  /**
   * Maximum number of buckets to keep in memory at once (prevents memory exhaustion).
   * Default: 10_000
   */
  maxBuckets?: number;
  /**
   * Per-key-prefix overrides. The key prefix is matched against the start
   * of each bucket key (e.g. "server:" matches "server:my-server").
   */
  overrides?: Record<string, RateLimitOverride>;
}

/** Internal state of a single token bucket */
interface Bucket {
  tokens: number;
  lastRefill: number;
  maxTokens: number;
  refillRatePerSecond: number;
}

export class RateLimiter {
  private buckets: Map<string, Bucket> = new Map();
  private readonly defaultMaxTokens: number;
  private readonly defaultRefillRate: number;
  private readonly staleAfterMs: number;
  private readonly maxBuckets: number;
  private readonly overrides: Record<string, RateLimitOverride>;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: RateLimiterOptions = {}) {
    this.defaultMaxTokens = options.maxTokens ?? 60;
    this.defaultRefillRate = options.refillRatePerSecond ?? 1;
    this.staleAfterMs = options.staleAfterMs ?? 300_000;
    this.maxBuckets = options.maxBuckets ?? 10_000;
    this.overrides = options.overrides ?? {};

    const cleanupIntervalMs = options.cleanupIntervalMs ?? 60_000;
    this.cleanupTimer = setInterval(
      () => this.cleanupStaleBuckets(),
      cleanupIntervalMs,
    );
    // Allow the process to exit even if the timer is still running
    if (
      this.cleanupTimer &&
      typeof this.cleanupTimer === "object" &&
      "unref" in this.cleanupTimer
    ) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Try to consume one token from the bucket identified by `key`.
   *
   * Returns `{ allowed: true }` if a token was available, or
   * `{ allowed: false, retryAfterMs }` if the bucket is exhausted.
   */
  tryConsume(key: string): RateLimitResult {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      if (this.buckets.size >= this.maxBuckets) {
        // Run emergency cleanup
        this.cleanupStaleBuckets();
        if (this.buckets.size >= this.maxBuckets) {
          // If still at capacity, reject the request to prevent memory exhaustion
          return { allowed: false, retryAfterMs: 5000 };
        }
      }

      const { maxTokens, refillRatePerSecond } = this.resolveConfig(key);
      bucket = {
        tokens: maxTokens,
        lastRefill: now,
        maxTokens,
        refillRatePerSecond,
      };
      this.buckets.set(key, bucket);
    }

    this.refill(bucket, now);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true };
    }

    // Calculate when the next token will be available
    const tokensNeeded = 1 - bucket.tokens;
    const retryAfterMs = Math.ceil(
      (tokensNeeded / bucket.refillRatePerSecond) * 1000,
    );
    return { allowed: false, retryAfterMs };
  }

  /**
   * Refill tokens based on elapsed time since last refill.
   */
  private refill(bucket: Bucket, now: number): void {
    const elapsedMs = now - bucket.lastRefill;
    if (elapsedMs <= 0) return;

    const tokensToAdd = (elapsedMs / 1000) * bucket.refillRatePerSecond;
    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  /**
   * Resolve the rate limit configuration for a given key by checking
   * prefix-based overrides first, then falling back to defaults.
   */
  private resolveConfig(key: string): {
    maxTokens: number;
    refillRatePerSecond: number;
  } {
    for (const [prefix, override] of Object.entries(this.overrides)) {
      if (key.startsWith(prefix)) {
        return override;
      }
    }
    return {
      maxTokens: this.defaultMaxTokens,
      refillRatePerSecond: this.defaultRefillRate,
    };
  }

  /**
   * Remove buckets that have been idle (full and untouched) for longer
   * than `staleAfterMs`.
   */
  private cleanupStaleBuckets(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets.entries()) {
      const idleMs = now - bucket.lastRefill;
      if (idleMs >= this.staleAfterMs) {
        this.buckets.delete(key);
      }
    }
  }

  /**
   * Dispose of the cleanup timer. Call this when the rate limiter is no
   * longer needed (e.g. during application shutdown).
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.buckets.clear();
  }

  /** Number of tracked buckets (useful for testing/monitoring). */
  get size(): number {
    return this.buckets.size;
  }
}

// ---------------------------------------------------------------------------
// Singleton for the request pipeline
// ---------------------------------------------------------------------------

/** Default rate limiter instance used by the request pipeline. */
let defaultRateLimiter: RateLimiter | null = null;

/**
 * Get (or lazily create) the default RateLimiter for the MCP request
 * pipeline.
 *
 * Default limits:
 *  - 60 requests/minute per client (maxTokens: 60, refill: 1/s)
 *  - 30 requests/minute per server (maxTokens: 30, refill: 0.5/s)
 *  - 30 requests/minute per tool   (maxTokens: 30, refill: 0.5/s)
 */
export function getRateLimiter(): RateLimiter {
  if (!defaultRateLimiter) {
    defaultRateLimiter = new RateLimiter({
      // Default applies to client: keys
      maxTokens: 60,
      refillRatePerSecond: 1, // 60 per minute
      overrides: {
        "server:": { maxTokens: 30, refillRatePerSecond: 0.5 },
        "tool:": { maxTokens: 30, refillRatePerSecond: 0.5 },
      },
    });
  }
  return defaultRateLimiter;
}

/**
 * Reset the default rate limiter (e.g. on workspace switch or shutdown).
 */
export function resetRateLimiter(): void {
  if (defaultRateLimiter) {
    defaultRateLimiter.dispose();
    defaultRateLimiter = null;
  }
}
