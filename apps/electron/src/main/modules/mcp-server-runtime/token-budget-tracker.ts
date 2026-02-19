/**
 * In-memory token budget tracker for MCP servers and tools.
 *
 * Tracks per-server and per-tool token usage across the session,
 * providing observability into which servers and tools consume the
 * most context window budget.
 */

import { estimateToolDefinitionTokens } from "./token-estimator";

/** Stats for a single server's token usage. */
export interface ServerTokenStats {
  totalTokens: number;
  toolDefinitionTokens: number;
  requestTokens: number;
  responseTokens: number;
  callCount: number;
}

/** Stats for a single tool's token usage. */
export interface ToolTokenStats {
  toolName: string;
  tokens: number;
  callCount: number;
}

/** Tool Catalog savings comparison. */
export interface ToolCatalogSavings {
  /** Tokens consumed if all tool definitions were sent to every client. */
  withoutCatalog: number;
  /** Tokens consumed with Tool Catalog (only meta-tool definitions). */
  withCatalog: number;
  /** Tokens saved by using the catalog. */
  savedTokens: number;
  /** Percentage of tokens saved (0-100). */
  savingsPercent: number;
}

/**
 * Tracks token usage per server and per tool for the current session.
 * All data is held in memory and resets when the application restarts
 * or when `reset()` is called explicitly.
 */
export class TokenBudgetTracker {
  private static instance: TokenBudgetTracker | null = null;

  /** Per-server aggregated stats. */
  private serverStats = new Map<string, ServerTokenStats>();

  /** Per-server, per-tool stats. Key: `${serverName}::${toolName}` */
  private toolStats = new Map<string, { tokens: number; callCount: number }>();

  /** Cached tool definition token counts. Key: serverName, Value: total definition tokens. */
  private toolDefinitionCache = new Map<string, number>();

  /** Total tool definition tokens across all servers (set via recordToolDefinitions). */
  private totalToolDefinitionTokens = 0;

  /** Meta-tool definition tokens (for catalog savings calculation). */
  private metaToolDefinitionTokens = 0;

  private constructor() {}

  /** Get the singleton instance. */
  public static getInstance(): TokenBudgetTracker {
    if (!TokenBudgetTracker.instance) {
      TokenBudgetTracker.instance = new TokenBudgetTracker();
    }
    return TokenBudgetTracker.instance;
  }

  /** Reset the singleton instance. */
  public static resetInstance(): void {
    TokenBudgetTracker.instance = null;
  }

  /**
   * Record token usage for a completed tool call.
   */
  public recordUsage(
    serverName: string,
    toolName: string,
    requestTokens: number,
    responseTokens: number,
  ): void {
    // Update server stats
    const existing = this.serverStats.get(serverName) || {
      totalTokens: 0,
      toolDefinitionTokens: 0,
      requestTokens: 0,
      responseTokens: 0,
      callCount: 0,
    };

    existing.requestTokens += requestTokens;
    existing.responseTokens += responseTokens;
    existing.totalTokens += requestTokens + responseTokens;
    existing.callCount += 1;
    this.serverStats.set(serverName, existing);

    // Update tool stats
    const toolKey = `${serverName}::${toolName}`;
    const existingTool = this.toolStats.get(toolKey) || {
      tokens: 0,
      callCount: 0,
    };
    existingTool.tokens += requestTokens + responseTokens;
    existingTool.callCount += 1;
    this.toolStats.set(toolKey, existingTool);
  }

  /**
   * Record tool definition tokens for a server.
   * Call this when tool definitions are loaded (e.g., during listTools).
   */
  public recordToolDefinitions(
    serverName: string,
    tools: Array<{
      name: string;
      description?: string;
      inputSchema?: object;
    }>,
  ): void {
    let totalForServer = 0;
    for (const tool of tools) {
      totalForServer += estimateToolDefinitionTokens(tool);
    }

    // Subtract previous value for this server if re-recording
    const previous = this.toolDefinitionCache.get(serverName) || 0;
    this.totalToolDefinitionTokens -= previous;

    this.toolDefinitionCache.set(serverName, totalForServer);
    this.totalToolDefinitionTokens += totalForServer;

    // Update the server stats entry
    const existing = this.serverStats.get(serverName) || {
      totalTokens: 0,
      toolDefinitionTokens: 0,
      requestTokens: 0,
      responseTokens: 0,
      callCount: 0,
    };
    existing.toolDefinitionTokens = totalForServer;
    this.serverStats.set(serverName, existing);
  }

  /**
   * Record meta-tool definition tokens (tool_discovery, tool_execute, tool_capabilities).
   * Used for catalog savings calculation.
   */
  public recordMetaToolDefinitions(
    metaTools: Array<{
      name: string;
      description?: string;
      inputSchema?: object;
    }>,
  ): void {
    this.metaToolDefinitionTokens = 0;
    for (const tool of metaTools) {
      this.metaToolDefinitionTokens += estimateToolDefinitionTokens(tool);
    }
  }

  /**
   * Get aggregated stats for all servers.
   */
  public getServerStats(): Map<string, ServerTokenStats> {
    return new Map(this.serverStats);
  }

  /**
   * Get per-tool stats for a specific server.
   */
  public getToolStats(serverName: string): ToolTokenStats[] {
    const prefix = `${serverName}::`;
    const results: ToolTokenStats[] = [];

    for (const [key, stats] of this.toolStats.entries()) {
      if (key.startsWith(prefix)) {
        results.push({
          toolName: key.slice(prefix.length),
          tokens: stats.tokens,
          callCount: stats.callCount,
        });
      }
    }

    // Sort by token count descending
    return results.sort((a, b) => b.tokens - a.tokens);
  }

  /**
   * Get the total tokens consumed by ALL tool definitions across all servers.
   */
  public getTotalToolDefinitionTokens(): number {
    return this.totalToolDefinitionTokens;
  }

  /**
   * Quantify the token savings from using Tool Catalog mode.
   *
   * Without catalog: every tool definition is sent to the client.
   * With catalog: only the 3 meta-tool definitions are sent.
   */
  public getToolCatalogSavings(): ToolCatalogSavings {
    const withoutCatalog = this.totalToolDefinitionTokens;
    const withCatalog = this.metaToolDefinitionTokens;
    const savedTokens = Math.max(0, withoutCatalog - withCatalog);
    const savingsPercent =
      withoutCatalog > 0 ? Math.round((savedTokens / withoutCatalog) * 100) : 0;

    return {
      withoutCatalog,
      withCatalog,
      savedTokens,
      savingsPercent,
    };
  }

  /**
   * Reset all tracked data for the current session.
   */
  public reset(): void {
    this.serverStats.clear();
    this.toolStats.clear();
    this.toolDefinitionCache.clear();
    this.totalToolDefinitionTokens = 0;
    this.metaToolDefinitionTokens = 0;
  }
}

/**
 * Get the singleton TokenBudgetTracker instance.
 */
export function getTokenBudgetTracker(): TokenBudgetTracker {
  return TokenBudgetTracker.getInstance();
}
