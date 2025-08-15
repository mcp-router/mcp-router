import { getLogService } from "@/main/application/mcp-core/log/log-service";
import {
  McpManagerRequestLogEntry as RequestLogEntry,
  AGGREGATOR_SERVER_ID,
  AGGREGATOR_SERVER_NAME,
} from "@mcp_router/shared";

export class LoggingService {
  private serverNameToIdMap: Map<string, string>;

  constructor(serverNameToIdMap: Map<string, string>) {
    this.serverNameToIdMap = serverNameToIdMap;
  }

  /**
   * Get server ID by name
   */
  private getServerIdByName(name: string): string | undefined {
    return this.serverNameToIdMap.get(name);
  }

  /**
   * Record a log entry
   * @param logEntry The log entry to record
   * @param clientServerName Optional client server name to use instead of the aggregator name
   */
  public recordRequestLog(
    logEntry: RequestLogEntry,
    clientServerName?: string,
  ): void {
    // Determine server name and ID
    let serverName = AGGREGATOR_SERVER_NAME;
    let serverId = AGGREGATOR_SERVER_ID;

    if (clientServerName) {
      serverName = clientServerName;

      // サーバ名からIDへの変換を試みる
      const serverIdFromName = this.getServerIdByName(clientServerName);
      if (serverIdFromName) {
        serverId = serverIdFromName;
      } else {
        serverId = clientServerName; // IDが見つからない場合は名前をそのまま使用
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
    getLogService().addRequestLog({
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
}
