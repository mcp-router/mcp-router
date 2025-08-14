/**
 * MCP Hook System Type Definitions
 */

/**
 * Hook configuration
 */
export interface MCPHook {
  id: string;
  name: string;
  enabled: boolean;
  executionOrder: number; // 実行順序（小さい値から実行）
  hookType: "pre" | "post" | "both";

  // JavaScriptスクリプト
  script: string;

  // メタデータ
  createdAt: number;
  updatedAt: number;
}

/**
 * Hook execution context
 */
export interface HookContext {
  // リクエスト情報
  requestType:
    | "CallTool"
    | "ListTools"
    | "ReadResource"
    | "ListResources"
    | "GetPrompt"
    | "ListPrompts";
  serverName: string;
  serverId: string;
  clientId: string;
  token?: string;
  toolName?: string; // CallToolリクエストの場合のツール名

  // リクエスト本体
  request: {
    method: string;
    params: any;
  };

  // レスポンス情報（Post-hookでのみ利用可能）
  response?: any;
  error?: Error;

  // Hook間でデータを共有するためのメタデータ
  metadata: Record<string, any>;

  // 実行時間計測
  startTime: number;
  duration?: number; // Post-hookでのみ利用可能
}

/**
 * Hook execution result
 */
export interface HookResult {
  // 処理を続行するかどうか
  continue: boolean;

  // 変更されたコンテキスト（省略可能）
  context?: HookContext;

  // エラー発生時のエラー情報
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Hook execution error
 */
export class HookExecutionError extends Error {
  constructor(
    message: string,
    public code: string = "HOOK_EXECUTION_ERROR",
    public hookId?: string,
  ) {
    super(message);
    this.name = "HookExecutionError";
  }
}
