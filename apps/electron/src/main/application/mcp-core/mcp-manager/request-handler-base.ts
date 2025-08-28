import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { HookContext } from "@mcp_router/shared";
import { getHookService } from "@/main/domain/mcp-core/hook/hook-service";
import { TokenValidator } from "./token-validator";
import { LoggingService } from "./logging";
import { McpManagerRequestLogEntry as RequestLogEntry } from "@mcp_router/shared";

/**
 * Base class for request handlers with common Hook and error handling patterns
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
   * Execute a request with Hook processing
   */
  protected async executeWithHooks<T>(
    method: string,
    params: any,
    clientId: string,
    handler: () => Promise<T>,
    additionalMetadata?: Record<string, any>,
  ): Promise<T> {
    // Create hook context
    const hookContext: HookContext = {
      request: {
        method,
        params,
      },
      metadata: {
        clientId,
        ...additionalMetadata,
      },
    };

    // Execute pre-hooks
    const hookService = getHookService();
    const preHookResult = await hookService.executePreHooks(hookContext);
    if (!preHookResult.continue) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        preHookResult.error?.message || "Request blocked by hook",
      );
    }

    // Update context from pre-hook result
    const updatedContext = preHookResult.context || hookContext;

    try {
      // Execute the actual handler
      const result = await handler();

      // Create post-hook context with response
      const postContext: HookContext = {
        ...updatedContext,
        response: result,
      };

      // Execute post-hooks
      const postHookResult = await hookService.executePostHooks(postContext);
      if (!postHookResult.continue) {
        throw new McpError(
          ErrorCode.InternalError,
          postHookResult.error?.message || "Response blocked by hook",
        );
      }

      // Use the potentially modified response
      return postHookResult.context?.response || result;
    } catch (error: any) {
      // Create error context for post-hooks
      const errorContext: HookContext = {
        ...updatedContext,
        metadata: {
          ...updatedContext.metadata,
          error: error,
        },
      };

      // Execute post-hooks even on error
      await hookService.executePostHooks(errorContext);

      // Re-throw the original error
      throw error;
    }
  }

  /**
   * Execute a request with Hook processing and logging
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

    // Create hook context
    const hookContext: HookContext = {
      request: {
        method,
        params,
      },
      metadata: {
        clientId,
        serverName,
        ...additionalMetadata,
      },
    };

    // Execute pre-hooks
    const hookService = getHookService();
    const preHookResult = await hookService.executePreHooks(hookContext);
    if (!preHookResult.continue) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        preHookResult.error?.message || "Request blocked by hook",
      );
    }

    // Update context from pre-hook result
    const updatedContext = preHookResult.context || hookContext;

    try {
      // Execute the actual handler
      const result = await handler();

      // Create post-hook context with response
      const postContext: HookContext = {
        ...updatedContext,
        response: result,
      };

      // Execute post-hooks
      const postHookResult = await hookService.executePostHooks(postContext);
      if (!postHookResult.continue) {
        throw new McpError(
          ErrorCode.InternalError,
          postHookResult.error?.message || "Response blocked by hook",
        );
      }

      // Use the potentially modified response
      const finalResult = postHookResult.context?.response || result;

      // Log success
      logEntry.response = finalResult;
      logEntry.duration = Date.now() - new Date(logEntry.timestamp).getTime();
      this.loggingService.recordRequestLog(logEntry, serverName);

      return finalResult;
    } catch (error: any) {
      // Create error context for post-hooks
      const errorContext: HookContext = {
        ...updatedContext,
        metadata: {
          ...updatedContext.metadata,
          error: error,
        },
      };

      // Execute post-hooks even on error
      await hookService.executePostHooks(errorContext);

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
