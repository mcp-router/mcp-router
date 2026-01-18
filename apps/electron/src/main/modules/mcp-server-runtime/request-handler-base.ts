import { TokenValidator } from "./token-validator";
import { getLogService } from "@/main/modules/mcp-logger/mcp-logger.service";
import { McpManagerRequestLogEntry as RequestLogEntry } from "@mcp_router/shared";

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
    // Workflowの実行を試みる
    try {
      // WorkflowServiceとWorkflowExecutorをインポート
      const { getWorkflowService } =
        await import("../workflow/workflow.service");
      const { WorkflowExecutor } =
        await import("../workflow/workflow-executor");
      const workflowService = getWorkflowService();

      // 該当するWorkflowを取得（tools/list または tools/call）
      const workflowType = method; // "tools/list" or "tools/call"
      const workflows = await workflowService.getWorkflowsByType(workflowType);

      // 有効かつ構造的に妥当なWorkflowをフィルタリング
      const validWorkflows = workflows.filter((w) => {
        if (!w.enabled) {
          return false;
        }

        // Workflowの構造を検証（Start -> MCP Call -> End が接続されている）
        const isValid = WorkflowExecutor.isValidWorkflow(w);
        if (!isValid) {
          console.warn(
            `Workflow ${w.name} (${w.id}) is not valid for execution`,
          );
        }
        return isValid;
      });

      // 実行コンテキストを構築
      const context = {
        method,
        params,
        clientId,
        timestamp: Date.now(),
        mcpHandler: handler, // MCPハンドラーをコンテキストに追加
        ...additionalMetadata,
      };

      // 有効なWorkflowがある場合は実行
      if (validWorkflows.length > 0) {
        console.log(
          `Found ${validWorkflows.length} valid workflows for ${method}`,
        );

        // 最初の有効なWorkflowを実行（複数ある場合は最初のものを使用）
        // TODO: 複数のWorkflow実行戦略を検討
        const workflow = validWorkflows[0];

        try {
          console.log(`Executing workflow: ${workflow.name} (${workflow.id})`);
          const result = await workflowService.executeWorkflow(
            workflow.id,
            context,
          );

          // Workflow内でMCPリクエストが実行された場合、その結果を返す
          if (result.mcpResult !== undefined) {
            console.log(`Workflow execution successful, returning MCP result`);
            return result.mcpResult as T;
          }

          // MCPリクエストが実行されなかった場合はエラー
          console.error(
            `Workflow ${workflow.name} did not execute MCP request`,
          );
          throw new Error(
            `Workflow ${workflow.name} did not execute MCP request`,
          );
        } catch (error) {
          console.error(`Failed to execute workflow ${workflow.name}:`, error);
          // Workflow実行に失敗した場合は、通常のハンドラーを実行
          console.log(`Falling back to direct handler execution`);
          return await handler();
        }
      } else {
        console.log(`No valid workflows found for ${method}`);
      }
    } catch (error) {
      // Workflow設定のエラーはログに記録するが、MCPリクエストは継続
      console.error(`Error setting up workflows for ${method}:`, error);
    }

    // Workflowがない場合は通常のハンドラーを実行
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
