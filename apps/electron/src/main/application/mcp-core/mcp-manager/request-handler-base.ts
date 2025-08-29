import { TokenValidator } from "./token-validator";
import { LoggingService } from "./logging";
import { McpManagerRequestLogEntry as RequestLogEntry } from "@mcp_router/shared";

/**
 * Base class for request handlers with common error handling patterns
 */
export abstract class RequestHandlerBase {
  protected tokenValidator: TokenValidator;
  protected loggingService: LoggingService;

  constructor(tokenValidator: TokenValidator, loggingService: LoggingService) {
    this.tokenValidator = tokenValidator;
    this.loggingService = loggingService;
  }

  /**
   * Extract client ID from token
   */
  protected getClientId(token?: string): string {
    return token
      ? this.tokenValidator.validateToken(token).clientId || "unknownClient"
      : "unknownClient";
  }

  /**
   * Execute a request
   */
  protected async executeWithHooks<T>(
    method: string,
    params: any,
    clientId: string,
    handler: () => Promise<T>,
    additionalMetadata?: Record<string, any>,
  ): Promise<T> {
    // Simply execute the handler
    return await handler();
  }

  /**
   * Execute a request with logging
   */
  protected async executeWithHooksAndLogging<T>(
    method: string,
    params: any,
    clientId: string,
    serverName: string,
    requestType: string,
    handler: () => Promise<T>,
    additionalMetadata?: Record<string, any>,
  ): Promise<T> {
    // Create log entry
    const logEntry: RequestLogEntry = {
      timestamp: new Date().toISOString(),
      requestType,
      params,
      result: "success",
      duration: 0,
      clientId,
    };

    try {
      // Execute the actual handler
      const result = await handler();

      // Log success
      logEntry.response = result;
      logEntry.duration = Date.now() - new Date(logEntry.timestamp).getTime();
      this.loggingService.recordRequestLog(logEntry, serverName);

      return result;
    } catch (error: any) {
      // Log error
      logEntry.result = "error";
      logEntry.errorMessage = error.message || String(error);
      logEntry.duration = Date.now() - new Date(logEntry.timestamp).getTime();
      this.loggingService.recordRequestLog(logEntry, serverName);

      // Re-throw the original error
      throw error;
    }
  }
}
