/**
 * Workflow types for MCP Router
 */

/**
 * Workflow node types
 */
export interface WorkflowNode {
  id: string;
  type: "start" | "end" | "mcp-call" | "hook";
  position: {
    x: number;
    y: number;
  };
  data: {
    label: string;
    hook?: WorkflowHook;
    [key: string]: any;
  };
  deletable?: boolean;
}

/**
 * Workflow edge types
 */
export interface WorkflowEdge {
  id?: string;
  source: string;
  target: string;
  type?: string;
  animated?: boolean;
  markerEnd?: {
    type: string;
    width: number;
    height: number;
  };
}

/**
 * Workflow hook (deprecated - kept for compatibility)
 */
export interface WorkflowHook {
  id: string;
  hookModuleId?: string; // HookModuleへの参照
  script?: string; // Inline Script用（hookModuleIdがない場合のみ使用）
  blocking: boolean;
}

/**
 * Hook module definition
 */
export interface HookModule {
  id: string;
  name: string;
  script: string;
}

/**
 * Workflow definition
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
