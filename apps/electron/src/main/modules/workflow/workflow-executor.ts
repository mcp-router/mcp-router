import {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  WorkflowHook,
} from "@mcp_router/shared";
import { getHookService } from "./hook.service";

/**
 * WorkflowExecutor
 * Workflowの実行エンジン
 * ノードグラフを解析し、順序立てて実行する
 */
export class WorkflowExecutor {
  private workflow: WorkflowDefinition;
  private hookService = getHookService();

  constructor(workflow: WorkflowDefinition) {
    this.workflow = workflow;
  }

  /**
   * Workflowが有効な構造を持っているか検証
   * Start -> MCP Call -> End が接続されている必要がある
   */
  public static isValidWorkflow(workflow: WorkflowDefinition): boolean {
    const nodes = workflow.nodes;
    const edges = workflow.edges;

    // 必須ノードの存在確認
    const startNode = nodes.find((n) => n.type === "start");
    const endNode = nodes.find((n) => n.type === "end");
    const mcpCallNode = nodes.find((n) => n.type === "mcp-call");

    if (!startNode || !endNode || !mcpCallNode) {
      console.warn(
        `Workflow ${workflow.name} is missing required nodes: start=${!!startNode}, mcp-call=${!!mcpCallNode}, end=${!!endNode}`,
      );
      return false;
    }

    // パスの存在確認: Start -> MCP Call
    const pathFromStartToMcp = WorkflowExecutor.hasPath(
      edges,
      startNode.id,
      mcpCallNode.id,
    );

    // パスの存在確認: MCP Call -> End
    const pathFromMcpToEnd = WorkflowExecutor.hasPath(
      edges,
      mcpCallNode.id,
      endNode.id,
    );

    if (!pathFromStartToMcp || !pathFromMcpToEnd) {
      console.warn(
        `Workflow ${workflow.name} does not have valid connections: start->mcp=${pathFromStartToMcp}, mcp->end=${pathFromMcpToEnd}`,
      );
      return false;
    }

    return true;
  }

  /**
   * グラフ内で fromId から toId へのパスが存在するか確認
   */
  private static hasPath(
    edges: WorkflowEdge[],
    fromId: string,
    toId: string,
  ): boolean {
    // 隣接リストを作成
    const adjacencyList: Record<string, string[]> = {};
    edges.forEach((edge) => {
      if (!adjacencyList[edge.source]) {
        adjacencyList[edge.source] = [];
      }
      adjacencyList[edge.source].push(edge.target);
    });

    // BFSでパスを探索
    const visited = new Set<string>();
    const queue = [fromId];
    visited.add(fromId);

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current === toId) {
        return true;
      }

      const neighbors = adjacencyList[current] || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    return false;
  }

  /**
   * Workflowを実行
   * @param context 実行コンテキスト（MCPリクエストの情報など）
   */
  public async execute(context: any): Promise<any> {
    if (!this.workflow.enabled) {
      throw new Error(`Workflow is disabled: ${this.workflow.id}`);
    }

    // ノードの実行順序を決定
    const executionOrder = this.determineExecutionOrder();

    // 実行結果を格納
    const results: Record<string, any> = {};

    // MCPリクエストの実行結果
    let mcpResult: any = undefined;

    try {
      // 各ノードを順番に実行
      for (const nodeId of executionOrder) {
        const node = this.workflow.nodes.find((n) => n.id === nodeId);
        if (!node) continue;

        const result = await this.executeNode(node, context, results);
        results[nodeId] = result;

        // mcp-callノードの結果を保存
        if (node.type === "mcp-call" && result.mcpResponse !== undefined) {
          mcpResult = result.mcpResponse;
        }
      }

      return {
        workflowId: this.workflow.id,
        workflowName: this.workflow.name,
        status: "completed",
        executedAt: Date.now(),
        context,
        results,
        mcpResult, // MCPリクエストの結果を含める
      };
    } catch (error) {
      console.error(`Error executing workflow ${this.workflow.id}:`, error);
      return {
        workflowId: this.workflow.id,
        workflowName: this.workflow.name,
        status: "error",
        executedAt: Date.now(),
        context,
        results,
        mcpResult,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * ノードの実行順序を決定
   * トポロジカルソートを使用してDAGの実行順序を決定
   */
  private determineExecutionOrder(): string[] {
    const nodes = this.workflow.nodes;
    const edges = this.workflow.edges;

    // 隣接リストを作成
    const adjacencyList: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};

    // 初期化
    nodes.forEach((node) => {
      adjacencyList[node.id] = [];
      inDegree[node.id] = 0;
    });

    // エッジから隣接リストと入次数を構築
    edges.forEach((edge) => {
      adjacencyList[edge.source].push(edge.target);
      inDegree[edge.target]++;
    });

    // トポロジカルソート（カーンのアルゴリズム）
    const queue: string[] = [];
    const executionOrder: string[] = [];

    // 入次数が0のノード（開始ノード）をキューに追加
    Object.keys(inDegree).forEach((nodeId) => {
      if (inDegree[nodeId] === 0) {
        queue.push(nodeId);
      }
    });

    // BFSで処理
    while (queue.length > 0) {
      const currentNode = queue.shift()!;
      executionOrder.push(currentNode);

      // 隣接ノードの入次数を減らす
      adjacencyList[currentNode].forEach((neighbor) => {
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) {
          queue.push(neighbor);
        }
      });
    }

    // 循環がある場合はエラー
    if (executionOrder.length !== nodes.length) {
      throw new Error("Workflow contains a cycle");
    }

    return executionOrder;
  }

  /**
   * 個別のノードを実行
   */
  private async executeNode(
    node: WorkflowNode,
    context: any,
    previousResults: Record<string, any>,
  ): Promise<any> {
    console.log(`Executing node: ${node.id} (${node.type})`);

    switch (node.type) {
      case "start":
        // 開始ノードは何もしない
        return { started: true, timestamp: Date.now() };

      case "end":
        // 終了ノードは最終結果を返す
        return { completed: true, timestamp: Date.now(), previousResults };

      case "hook":
        // Hookノードの実行
        return await this.executeHookNode(node, context, previousResults);

      case "mcp-call":
        // MCPコールノード - 本来のMCPリクエストを実行
        return await this.executeMcpCallNode(node, context, previousResults);

      default:
        console.warn(`Unknown node type: ${node.type}`);
        return { skipped: true, reason: `Unknown node type: ${node.type}` };
    }
  }

  /**
   * MCPコールノードを実行
   */
  private async executeMcpCallNode(
    node: WorkflowNode,
    context: any,
    previousResults: Record<string, any>,
  ): Promise<any> {
    console.log(`Executing MCP call node: ${node.id}`);

    // コンテキストからMCPハンドラーを取得
    const mcpHandler = context.mcpHandler;

    if (!mcpHandler || typeof mcpHandler !== "function") {
      console.error("MCP handler not found in context");
      return {
        type: "mcp-call",
        error: "MCP handler not found",
        timestamp: Date.now(),
      };
    }

    try {
      // MCPリクエストを実行
      console.log(`Executing MCP request: ${context.method}`);
      const mcpResponse = await mcpHandler();

      return {
        type: "mcp-call",
        success: true,
        mcpResponse, // MCPレスポンスを含める
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error(`Error executing MCP request:`, error);
      return {
        type: "mcp-call",
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Hookノードを実行
   */
  private async executeHookNode(
    node: WorkflowNode,
    context: any,
    previousResults: Record<string, any>,
  ): Promise<any> {
    const hook = node.data?.hook as WorkflowHook | undefined;

    if (!hook) {
      console.warn(`Hook node ${node.id} has no hook configuration`);
      return { skipped: true, reason: "No hook configuration" };
    }

    // Hook実行用のコンテキストを構築
    const hookContext = {
      ...context,
      workflowId: this.workflow.id,
      workflowName: this.workflow.name,
      nodeId: node.id,
      nodeName: node.data?.label || node.id,
      previousResults,
    };

    try {
      let scriptToExecute: string | undefined;

      // HookModuleを参照している場合
      if (hook.hookModuleId) {
        const module = await this.hookService.getHookModuleById(
          hook.hookModuleId,
        );
        if (!module) {
          console.error(`Hook module not found: ${hook.hookModuleId}`);
          return {
            success: false,
            error: `Hook module not found: ${hook.hookModuleId}`,
            timestamp: Date.now(),
          };
        }
        scriptToExecute = module.script;
      } else if (hook.script) {
        // インラインスクリプトの場合
        scriptToExecute = hook.script;
      }

      if (scriptToExecute) {
        // スクリプトを実行
        const result = await this.hookService.executeHookScript(
          scriptToExecute,
          hookContext,
        );
        return {
          success: true,
          result,
          timestamp: Date.now(),
        };
      } else {
        return {
          skipped: true,
          reason: "No script specified",
        };
      }
    } catch (error) {
      console.error(`Error executing hook node ${node.id}:`, error);

      // エラーが発生してもWorkflowの実行を継続（設定により変更可能）
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * 前処理Hookを実行（将来の拡張用）
   */
  public async executePreHooks(context: any): Promise<any[]> {
    const preHookNodes = this.workflow.nodes.filter(
      (node) => node.type === "hook" && this.isPreHook(node),
    );

    const results = [];
    for (const node of preHookNodes) {
      const result = await this.executeHookNode(node, context, {});
      results.push(result);
    }

    return results;
  }

  /**
   * 後処理Hookを実行（将来の拡張用）
   */
  public async executePostHooks(context: any, response: any): Promise<any[]> {
    const postHookNodes = this.workflow.nodes.filter(
      (node) => node.type === "hook" && this.isPostHook(node),
    );

    const hookContext = { ...context, response };
    const results = [];
    for (const node of postHookNodes) {
      const result = await this.executeHookNode(node, hookContext, {});
      results.push(result);
    }

    return results;
  }

  /**
   * ノードが前処理Hookかどうかを判定（将来の拡張用）
   */
  private isPreHook(node: WorkflowNode): boolean {
    // startノードから直接つながっているか、mcp-callノードの前にあるか
    const startNode = this.workflow.nodes.find((n) => n.type === "start");
    if (!startNode) return false;

    const edgesFromStart = this.workflow.edges.filter(
      (e) => e.source === startNode.id,
    );
    return edgesFromStart.some((e) => e.target === node.id);
  }

  /**
   * ノードが後処理Hookかどうかを判定（将来の拡張用）
   */
  private isPostHook(node: WorkflowNode): boolean {
    // endノードに直接つながっているか、mcp-callノードの後にあるか
    const endNode = this.workflow.nodes.find((n) => n.type === "end");
    if (!endNode) return false;

    const edgesToEnd = this.workflow.edges.filter(
      (e) => e.target === endNode.id,
    );
    return edgesToEnd.some((e) => e.source === node.id);
  }
}
