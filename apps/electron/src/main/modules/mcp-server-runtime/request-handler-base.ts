import { TokenValidator } from "./token-validator";
import { getLogService } from "@/main/modules/mcp-logger/mcp-logger.service";
import { McpManagerRequestLogEntry as RequestLogEntry } from "@mcp_router/shared";

// Cache for dynamic imports (resolved once, reused forever)
let workflowImportsCache: {
  getWorkflowService: () => any;
  WorkflowExecutor: any;
} | null = null;

// TTL cache for active workflow lookups, keyed by workflow type (method)
const workflowLookupCache = new Map<
  string,
  { workflows: any[]; timestamp: number }
>();
const WORKFLOW_CACHE_TTL = 5000; // 5 seconds

/**
 * Invalidate the workflow lookup cache. Call this when workflows are
 * created, updated, deleted, or toggled so the next request picks up
 * the change immediately instead of waiting for the TTL to expire.
 */
export function invalidateWorkflowCache(): void {
  workflowLookupCache.clear();
}

/**
 * Base class for request handlers with common error handling patterns
 */
export abstract class RequestHandlerBase {
  protected tokenValidator: TokenValidator;

  constructor(tokenValidator: TokenValidator) {
    this.tokenValidator = tokenValidator;
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
    // Try to execute via Workflow
    try {
      // Import WorkflowService and WorkflowExecutor (cached after first import)
      if (!workflowImportsCache) {
        const [wsModule, weModule] = await Promise.all([
          import("../workflow/workflow.service"),
          import("../workflow/workflow-executor"),
        ]);
        workflowImportsCache = {
          getWorkflowService: wsModule.getWorkflowService,
          WorkflowExecutor: weModule.WorkflowExecutor,
        };
      }
      const { getWorkflowService, WorkflowExecutor } = workflowImportsCache;
      const workflowService = getWorkflowService();

      // Get matching workflows (tools/list or tools/call) with TTL cache
      const workflowType = method; // "tools/list" or "tools/call"
      const now = Date.now();
      const cached = workflowLookupCache.get(workflowType);

      let validWorkflows: any[];
      if (cached && now - cached.timestamp < WORKFLOW_CACHE_TTL) {
        validWorkflows = cached.workflows;
      } else {
        const workflows =
          await workflowService.getWorkflowsByType(workflowType);

        // Filter for enabled and structurally valid workflows
        validWorkflows = workflows.filter((w: any) => {
          if (!w.enabled) {
            return false;
          }

          // Validate workflow structure (Start -> MCP Call -> End connected)
          const isValid = WorkflowExecutor.isValidWorkflow(w);
          if (!isValid) {
            console.warn(
              `Workflow ${w.name} (${w.id}) is not valid for execution`,
            );
          }
          return isValid;
        });

        workflowLookupCache.set(workflowType, {
          workflows: validWorkflows,
          timestamp: now,
        });
      }

      // Build execution context
      const context = {
        method,
        params,
        clientId,
        timestamp: Date.now(),
        mcpHandler: handler, // Add MCP handler to context
        ...additionalMetadata,
      };

      // Execute if valid workflows exist
      if (validWorkflows.length > 0) {
        console.log(
          `Found ${validWorkflows.length} valid workflows for ${method}`,
        );

        // Execute the first valid workflow (use first one if multiple exist)
        // TODO: Consider execution strategy for multiple workflows
        const workflow = validWorkflows[0];

        try {
          console.log(`Executing workflow: ${workflow.name} (${workflow.id})`);
          const result = await workflowService.executeWorkflow(
            workflow.id,
            context,
          );

          // Return MCP result if the MCP request was executed within the workflow
          if (result.mcpResult !== undefined) {
            console.log(`Workflow execution successful, returning MCP result`);
            return result.mcpResult as T;
          }

          // Error if MCP request was not executed
          console.error(
            `Workflow ${workflow.name} did not execute MCP request`,
          );
          throw new Error(
            `Workflow ${workflow.name} did not execute MCP request`,
          );
        } catch (error) {
          console.error(`Failed to execute workflow ${workflow.name}:`, error);
          // Fall back to direct handler execution on workflow failure
          console.log(`Falling back to direct handler execution`);
          return await handler();
        }
      } else {
        console.log(`No valid workflows found for ${method}`);
      }
    } catch (error) {
      // Log workflow setup errors but continue with MCP request
      console.error(`Error setting up workflows for ${method}:`, error);
    }

    // Execute handler directly when no workflow is available
    console.log(`Executing handler directly without workflow`);
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
    _additionalMetadata?: Record<string, any>,
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
      getLogService().recordMcpRequestLog(logEntry, serverName);

      return result;
    } catch (error: any) {
      // Log error
      logEntry.result = "error";
      logEntry.errorMessage = error.message || String(error);
      logEntry.duration = Date.now() - new Date(logEntry.timestamp).getTime();
      getLogService().recordMcpRequestLog(logEntry, serverName);

      // Re-throw the original error
      throw error;
    }
  }
}
