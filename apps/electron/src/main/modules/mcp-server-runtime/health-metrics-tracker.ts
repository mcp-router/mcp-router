/**
 * Health metrics tracker for MCP servers.
 *
 * Collects status changes and request latency data per server,
 * then computes uptime percentages (24h / 7d), average latency,
 * and success rates on demand.  Status history is kept in a
 * fixed-size circular buffer (last 7 days worth of entries).
 */

/** The possible connection statuses we track. */
export type TrackedStatus =
  | "connected"
  | "disconnected"
  | "connecting"
  | "reconnecting"
  | "failed"
  | "starting"
  | "stopping"
  | "error";

/** A single status-change entry in the history ring buffer. */
export interface StatusHistoryEntry {
  timestamp: number;
  status: TrackedStatus;
}

/** Per-server health metrics returned by getMetrics(). */
export interface ServerHealthMetrics {
  serverId: string;
  serverName: string;
  currentStatus: TrackedStatus;
  uptimePercent24h: number;
  uptimePercent7d: number;
  avgLatencyMs: number;
  totalRequests: number;
  failedRequests: number;
  successRate: number;
  lastHealthCheck: number;
  statusHistory: StatusHistoryEntry[];
}

/** Aggregate health summary returned by getAggregateHealth(). */
export interface AggregateHealth {
  totalServers: number;
  healthyServers: number;
  avgUptimePercent: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const MS_24H = 24 * 60 * 60 * 1000;
const MS_7D = 7 * 24 * 60 * 60 * 1000;

/**
 * Maximum number of status history entries per server.
 * With one entry per state change this is generous for 7 days
 * of typical operation (a server that reconnects every 30 s
 * would generate ~20 160 entries in 7 days).
 */
const MAX_HISTORY_ENTRIES = 25_000;

/** Internal per-server data. */
interface ServerData {
  serverId: string;
  serverName: string;
  currentStatus: TrackedStatus;
  /** Ring buffer of status changes. */
  history: StatusHistoryEntry[];
  /** Index of the next write position in the ring buffer. */
  historyWriteIdx: number;
  /** Total entries written (may exceed MAX_HISTORY_ENTRIES). */
  historyCount: number;
  /** Latency tracking. */
  totalLatencyMs: number;
  totalRequests: number;
  failedRequests: number;
  lastHealthCheck: number;
}

// ---------------------------------------------------------------------------
// HealthMetricsTracker
// ---------------------------------------------------------------------------

export class HealthMetricsTracker {
  private servers: Map<string, ServerData> = new Map();

  // -----------------------------------------------------------------------
  // Recording methods (called by infrastructure code)
  // -----------------------------------------------------------------------

  /**
   * Record a server status change.
   *
   * Call this whenever a server's connection state transitions
   * (e.g., connected -> reconnecting).
   */
  recordStatusChange(
    serverId: string,
    serverName: string,
    status: TrackedStatus,
  ): void {
    const data = this.ensureServer(serverId, serverName);
    data.currentStatus = status;
    data.lastHealthCheck = Date.now();

    const entry: StatusHistoryEntry = {
      timestamp: Date.now(),
      status,
    };

    // Circular buffer write
    if (data.history.length < MAX_HISTORY_ENTRIES) {
      data.history.push(entry);
    } else {
      data.history[data.historyWriteIdx] = entry;
    }
    data.historyWriteIdx = (data.historyWriteIdx + 1) % MAX_HISTORY_ENTRIES;
    data.historyCount++;

    // Prune entries older than 7 days to keep memory bounded
    this.pruneOldEntries(data);
  }

  /**
   * Record the result of a request routed through a server.
   *
   * @param serverId  - Unique server identifier.
   * @param latencyMs - Wall-clock duration of the request in milliseconds.
   * @param success   - Whether the request completed without error.
   */
  recordRequestLatency(
    serverId: string,
    latencyMs: number,
    success: boolean,
  ): void {
    const data = this.servers.get(serverId);
    if (!data) return; // Server not yet tracked (no status change seen)

    data.totalRequests++;
    data.totalLatencyMs += latencyMs;
    if (!success) {
      data.failedRequests++;
    }
  }

  // -----------------------------------------------------------------------
  // Query methods
  // -----------------------------------------------------------------------

  /**
   * Get health metrics for a single server.
   * Returns undefined if no data has been recorded for the given serverId.
   */
  getMetrics(serverId: string): ServerHealthMetrics | undefined {
    const data = this.servers.get(serverId);
    if (!data) return undefined;
    return this.buildMetrics(data);
  }

  /** Get health metrics for all tracked servers. */
  getAllMetrics(): ServerHealthMetrics[] {
    const result: ServerHealthMetrics[] = [];
    for (const data of this.servers.values()) {
      result.push(this.buildMetrics(data));
    }
    return result;
  }

  /** Get a high-level aggregate health summary across all tracked servers. */
  getAggregateHealth(): AggregateHealth {
    let totalServers = 0;
    let healthyServers = 0;
    let uptimeSum = 0;

    for (const data of this.servers.values()) {
      totalServers++;
      const uptime = this.computeUptimePercent(data, MS_24H);
      uptimeSum += uptime;
      if (data.currentStatus === "connected") {
        healthyServers++;
      }
    }

    return {
      totalServers,
      healthyServers,
      avgUptimePercent:
        totalServers > 0
          ? Math.round((uptimeSum / totalServers) * 100) / 100
          : 0,
    };
  }

  /** Remove all data for a server (e.g., when the server is deleted). */
  removeServer(serverId: string): void {
    this.servers.delete(serverId);
  }

  /** Clear all tracked data (e.g., on workspace switch). */
  reset(): void {
    this.servers.clear();
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private ensureServer(serverId: string, serverName: string): ServerData {
    let data = this.servers.get(serverId);
    if (!data) {
      data = {
        serverId,
        serverName,
        currentStatus: "disconnected",
        history: [],
        historyWriteIdx: 0,
        historyCount: 0,
        totalLatencyMs: 0,
        totalRequests: 0,
        failedRequests: 0,
        lastHealthCheck: 0,
      };
      this.servers.set(serverId, data);
    }
    // Keep the name up to date in case it was renamed.
    data.serverName = serverName;
    return data;
  }

  /**
   * Build a ServerHealthMetrics snapshot from internal data.
   */
  private buildMetrics(data: ServerData): ServerHealthMetrics {
    const successfulRequests = data.totalRequests - data.failedRequests;
    const successRate =
      data.totalRequests > 0
        ? Math.round((successfulRequests / data.totalRequests) * 10000) / 100
        : 100;
    const avgLatencyMs =
      data.totalRequests > 0
        ? Math.round(data.totalLatencyMs / data.totalRequests)
        : 0;

    const statusHistory = this.getOrderedHistory(data);

    return {
      serverId: data.serverId,
      serverName: data.serverName,
      currentStatus: data.currentStatus,
      uptimePercent24h: this.computeUptimePercent(data, MS_24H, statusHistory),
      uptimePercent7d: this.computeUptimePercent(data, MS_7D, statusHistory),
      avgLatencyMs,
      totalRequests: data.totalRequests,
      failedRequests: data.failedRequests,
      successRate,
      lastHealthCheck: data.lastHealthCheck,
      statusHistory,
    };
  }

  /**
   * Compute the percentage of time a server spent in the "connected"
   * state within the given window (e.g., last 24 h).
   *
   * The algorithm walks the ordered status history in chronological
   * order, accumulating time spent as "connected" within the window.
   */
  private computeUptimePercent(
    data: ServerData,
    windowMs: number,
    ordered: StatusHistoryEntry[] = this.getOrderedHistory(data),
  ): number {
    const now = Date.now();
    const windowStart = now - windowMs;

    if (ordered.length === 0) {
      // No history at all -- if currently connected, assume 100 %
      return data.currentStatus === "connected" ? 100 : 0;
    }

    let connectedMs = 0;

    // Walk entries within the window
    for (let i = 0; i < ordered.length; i++) {
      const entry = ordered[i];
      const nextTimestamp =
        i + 1 < ordered.length ? ordered[i + 1].timestamp : now;

      // Clamp to window boundaries
      const segmentStart = Math.max(entry.timestamp, windowStart);
      const segmentEnd = Math.min(nextTimestamp, now);

      if (segmentEnd <= windowStart) continue; // entirely before window
      if (segmentStart >= now) break; // entirely after now (shouldn't happen)

      if (entry.status === "connected") {
        connectedMs += segmentEnd - segmentStart;
      }
    }

    // Handle the case where the first tracked entry is after windowStart.
    // We don't know the state before the first entry, so we skip that gap
    // (treated as unknown / not connected).

    const pct = (connectedMs / windowMs) * 100;
    return Math.round(pct * 100) / 100; // two decimal places
  }

  /**
   * Return the history entries in chronological order.
   *
   * Because we use a circular buffer, entries may wrap around.
   * This method re-orders them so the oldest entry comes first.
   */
  private getOrderedHistory(data: ServerData): StatusHistoryEntry[] {
    if (data.history.length < MAX_HISTORY_ENTRIES) {
      // Buffer hasn't wrapped yet; entries are already in order
      return data.history;
    }

    // Buffer has wrapped: entries from writeIdx..end are older,
    // entries from 0..writeIdx-1 are newer.
    return [
      ...data.history.slice(data.historyWriteIdx),
      ...data.history.slice(0, data.historyWriteIdx),
    ];
  }

  /**
   * Remove history entries older than 7 days.
   *
   * For the non-wrapped case we can simply shift from the front.
   * For the wrapped case we advance the write index past old entries.
   */
  private pruneOldEntries(data: ServerData): void {
    const cutoff = Date.now() - MS_7D;

    if (data.history.length < MAX_HISTORY_ENTRIES) {
      // Find the first entry that is NOT old
      const firstKeepIdx = data.history.findIndex(
        (entry) => entry.timestamp >= cutoff,
      );

      if (firstKeepIdx > 0) {
        // Remove all entries before the first keep index at once
        data.history.splice(0, firstKeepIdx);
        // Adjust write index since we removed from front
        data.historyWriteIdx = Math.max(0, data.historyWriteIdx - firstKeepIdx);
      } else if (firstKeepIdx === -1 && data.history.length > 0) {
        // All entries are old
        data.history.length = 0;
        data.historyWriteIdx = 0;
      }
    }
    // For a fully-wrapped buffer, old entries are naturally overwritten
    // by the circular write, so no explicit pruning is needed.
  }
}

// ---------------------------------------------------------------------------
// Singleton accessor
// ---------------------------------------------------------------------------

let instance: HealthMetricsTracker | null = null;

export function getHealthMetricsTracker(): HealthMetricsTracker {
  if (!instance) {
    instance = new HealthMetricsTracker();
  }
  return instance;
}

export function resetHealthMetricsTracker(): void {
  instance?.reset();
  instance = null;
}
