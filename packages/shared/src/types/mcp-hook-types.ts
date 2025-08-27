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
  // 純粋なMCPリクエスト
  request: {
    method: string; // "tools/call", "tools/list" など
    params: any; // MCPプロトコルのパラメータ
  };

  // 純粋なMCPレスポンス（Post-hookのみ）
  response?: any;

  // アプリケーション固有のメタデータ
  metadata: {
    // サーバー情報
    serverId: string;
    serverName: string;

    // クライアント情報
    clientId: string;

    // タイミング情報
    startTime: number;
    duration?: number; // Post-hookのみ

    // エラー情報
    error?: Error; // Post-hookのみ

    // Hook間共有データ
    shared?: Record<string, any>;
  };
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
