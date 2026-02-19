import { SingletonService } from "../singleton-service";
import {
  RequestLogEntry,
  RequestLogEntryInput,
  RequestLogQueryOptions,
  RequestLogQueryResult,
  McpManagerRequestLogEntry,
  AGGREGATOR_SERVER_ID,
  AGGREGATOR_SERVER_NAME,
} from "@mcp_router/shared";
import { McpLoggerRepository } from "./mcp-logger.repository";

/**
 * Batches log entries in memory and flushes them to the repository
 * periodically or when the buffer is full, reducing SQLite write overhead.
 */
class LogBuffer {
  private buffer: RequestLogEntryInput[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly FLUSH_INTERVAL_MS = 500;
  private readonly MAX_BUFFER_SIZE = 50;

  constructor(private readonly repository: McpLoggerRepository) {}

  add(entry: RequestLogEntryInput): void {
    this.buffer.push(entry);
    if (this.buffer.length >= this.MAX_BUFFER_SIZE) {
      this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.FLUSH_INTERVAL_MS);
    }
  }

  flush(): void {
    if (this.buffer.length === 0) return;
    const entries = this.buffer;
    this.buffer = [];
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    try {
      this.repository.transaction(() => {
        for (const entry of entries) {
          this.repository.addRequestLog(entry);
        }
      });
    } catch (error) {
      console.error("[LogBuffer] Batch flush error:", error);
    }
  }

  dispose(): void {
    this.flush();
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

/**
 * Request log service class
 */
export class McpLoggerService extends SingletonService<
  RequestLogEntry,
  string,
  McpLoggerService
> {
  private serverNameToIdMap: Map<string, string> | undefined;
  private logBuffer: LogBuffer | null = null;

  /**
   * Constructor
   */
  protected constructor() {
    super();
  }

  private getLogBuffer(): LogBuffer {
    if (!this.logBuffer) {
      this.logBuffer = new LogBuffer(McpLoggerRepository.getInstance());
    }
    return this.logBuffer;
  }

  /**
   * Set server name to ID map for logging
   */
  public setServerNameToIdMap(map: Map<string, string>): void {
    this.serverNameToIdMap = map;
  }

  /**
   * Get server ID by name
   */
  private getServerIdByName(name: string): string | undefined {
    return this.serverNameToIdMap?.get(name);
  }

  /**
   * Get entity name
   */
  protected getEntityName(): string {
    return "Request Log";
  }

  /**
   * Get singleton instance of LogService
   */
  public static getInstance(): McpLoggerService {
    return (this as any).getInstanceBase();
  }

  /**
   * Reset instance
   * Used when switching workspaces
   */
  public static resetInstance(): void {
    const instance = McpLoggerService.getInstance();
    if (instance.logBuffer) {
      instance.logBuffer.dispose();
      instance.logBuffer = null;
    }
    (this as any).resetInstanceBase(McpLoggerService);
  }

  //--------------------------------------------------------------------------------
  // Request log methods
  //--------------------------------------------------------------------------------

  /**
   * Add a request log (buffered for batch writes)
   */
  public async addRequestLog(
    entry: RequestLogEntryInput,
  ): Promise<RequestLogEntry> {
    try {
      this.getLogBuffer().add(entry);
      // Return a synthetic entry since the actual write is deferred
      return {
        ...entry,
        id: "",
        timestamp: Date.now(),
      };
    } catch (error) {
      return this.handleError("add", error);
    }
  }

  /**
   * Record a MCP manager request log entry
   * @param logEntry The log entry to record
   * @param clientServerName Optional client server name to use instead of the aggregator name
   */
  public recordMcpRequestLog(
    logEntry: McpManagerRequestLogEntry,
    clientServerName?: string,
  ): void {
    // Determine server name and ID
    let serverName = AGGREGATOR_SERVER_NAME;
    let serverId = AGGREGATOR_SERVER_ID;

    if (clientServerName) {
      serverName = clientServerName;

      // Try to convert server name to ID
      const serverIdFromName = this.getServerIdByName(clientServerName);
      if (serverIdFromName) {
        serverId = serverIdFromName;
      } else {
        serverId = clientServerName; // Use name as-is if ID not found
      }
    }

    // Extract client information from the request parameters
    const clientId = logEntry.clientId;
    const clientName = clientId; // Default to clientId

    // Try to determine client from the parameters
    if (logEntry.params) {
      // Remove token from logged parameters for security
      if (logEntry.params.token) {
        delete logEntry.params.token;
      }
      if (logEntry.params._meta?.token) {
        delete logEntry.params._meta.token;
      }
    }

    // Save as request log for visualization
    this.addRequestLog({
      clientId,
      clientName,
      serverId,
      serverName,
      requestType: logEntry.requestType,
      requestParams: logEntry.params,
      responseStatus: logEntry.result,
      responseData: logEntry.response,
      duration: logEntry.duration,
      errorMessage: logEntry.errorMessage,
    });
  }

  /**
   * Get request logs (cursor-based pagination with filtering)
   */
  public async getRequestLogs(
    options: RequestLogQueryOptions = {},
  ): Promise<RequestLogQueryResult> {
    try {
      return await McpLoggerRepository.getInstance().getRequestLogs(options);
    } catch (error) {
      return this.handleError("retrieval", error, {
        logs: [],
        total: 0,
        hasMore: false,
      });
    }
  }
}

/**
 * Get the singleton instance of LogService
 */
export function getLogService(): McpLoggerService {
  return McpLoggerService.getInstance();
}

// Initialize instance at application startup
export const logService = McpLoggerService.getInstance();
