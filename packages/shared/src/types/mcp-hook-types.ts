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
    // クライアント情報（必須）
    clientId: string;

    // サーバー情報（オプション）
    serverId?: string;
    serverName?: string;

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

/**
 * Workflow Node (Hook)
 */
export interface WorkflowNode {
  id: string;
  type: "hook" | "start" | "end";
  data: {
    label: string;
    hookId?: string; // type === 'hook' の場合
    hook?: MCPHook; // Hookの詳細情報
    blocking?: boolean; // 完了を待つか（デフォルト: true）
    timeout?: number; // タイムアウト（ms）
  };
  position: { x: number; y: number };
}

/**
 * Workflow Edge (Connection)
 */
export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type?: "default";
  label?: string;
}

/**
 * Workflow Definition
 */
export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  workflowType: "tools/list" | "tools/call";
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}
