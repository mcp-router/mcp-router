import { EventEmitter } from "events";

export interface ConsoleLogEntry {
  serverId: string;
  serverName: string;
  timestamp: string;
  type: "stdout" | "stderr";
  content: string;
}

/**
 * Service to manage console output from MCP servers
 */
class MCPServerConsoleService extends EventEmitter {
  private logs: Map<string, ConsoleLogEntry[]> = new Map();
  private maxLogsPerServer = 10000; // Maximum number of log entries per server

  /**
   * Add a log entry for a server
   */
  public addLog(
    serverId: string,
    serverName: string,
    type: "stdout" | "stderr",
    content: string,
  ): void {
    if (!this.logs.has(serverId)) {
      this.logs.set(serverId, []);
    }

    const serverLogs = this.logs.get(serverId)!;
    const entry: ConsoleLogEntry = {
      serverId,
      serverName,
      timestamp: new Date().toISOString(),
      type,
      content,
    };

    serverLogs.push(entry);

    // Limit the number of logs per server
    if (serverLogs.length > this.maxLogsPerServer) {
      serverLogs.shift(); // Remove oldest entry
    }

    // Emit event for real-time updates
    this.emit("log", entry);
    this.emit(`log:${serverId}`, entry);
  }

  /**
   * Get all logs for a specific server
   */
  public getServerLogs(serverId: string): ConsoleLogEntry[] {
    return this.logs.get(serverId) || [];
  }

  /**
   * Get logs for all running servers
   */
  public getAllLogs(): Map<string, ConsoleLogEntry[]> {
    return new Map(this.logs);
  }

  /**
   * Clear logs for a specific server
   */
  public clearServerLogs(serverId: string): void {
    this.logs.delete(serverId);
    this.emit("clear", serverId);
  }

  /**
   * Clear all logs
   */
  public clearAllLogs(): void {
    this.logs.clear();
    this.emit("clear", "all");
  }

  /**
   * Remove logs for a server when it's stopped
   */
  public removeServer(serverId: string): void {
    this.logs.delete(serverId);
    this.emit("remove", serverId);
  }
}

// Singleton instance
let consoleService: MCPServerConsoleService | null = null;

export function getConsoleService(): MCPServerConsoleService {
  if (!consoleService) {
    consoleService = new MCPServerConsoleService();
  }
  return consoleService;
}
