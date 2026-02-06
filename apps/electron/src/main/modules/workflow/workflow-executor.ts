import {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  WorkflowHook,
} from "@mcp_router/shared";
import { getHookService } from "./hook.service";

/**
 * WorkflowExecutor
 * Workflow execution engine.
 * Parses the node graph and executes nodes in order.
 */
export class WorkflowExecutor {
  private workflow: WorkflowDefinition;
  private hookService = getHookService();

  constructor(workflow: WorkflowDefinition) {
    this.workflow = workflow;
  }

  /**
   * Validate whether the workflow has a valid structure.
   * Requires Start -> MCP Call -> End to be connected.
   */
  public static isValidWorkflow(workflow: WorkflowDefinition): boolean {
    const nodes = workflow.nodes;
    const edges = workflow.edges;

    // Check for required nodes
    const startNode = nodes.find((n) => n.type === "start");
    const endNode = nodes.find((n) => n.type === "end");
    const mcpCallNode = nodes.find((n) => n.type === "mcp-call");

    if (!startNode || !endNode || !mcpCallNode) {
      console.warn(
        `Workflow ${workflow.name} is missing required nodes: start=${!!startNode}, mcp-call=${!!mcpCallNode}, end=${!!endNode}`,
      );
      return false;
    }

    // Check path existence: Start -> MCP Call
    const pathFromStartToMcp = WorkflowExecutor.hasPath(
      edges,
      startNode.id,
      mcpCallNode.id,
    );

    // Check path existence: MCP Call -> End
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
   * Check whether a path exists from fromId to toId in the graph
   */
  private static hasPath(
    edges: WorkflowEdge[],
    fromId: string,
    toId: string,
  ): boolean {
    // Build adjacency list
    const adjacencyList: Record<string, string[]> = {};
    edges.forEach((edge) => {
      if (!adjacencyList[edge.source]) {
        adjacencyList[edge.source] = [];
      }
      adjacencyList[edge.source].push(edge.target);
    });

    // BFS path search
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
   * Execute the workflow
   * @param context Execution context (MCP request information, etc.)
   */
  public async execute(context: any): Promise<any> {
    if (!this.workflow.enabled) {
      throw new Error(`Workflow is disabled: ${this.workflow.id}`);
    }

    // Determine node execution order
    const executionOrder = this.determineExecutionOrder();

    // Store execution results
    const results: Record<string, any> = {};

    // MCP request execution result
    let mcpResult: any = undefined;

    try {
      // Execute each node in order
      for (const nodeId of executionOrder) {
        const node = this.workflow.nodes.find((n) => n.id === nodeId);
        if (!node) continue;

        const result = await this.executeNode(node, context, results);
        results[nodeId] = result;

        // Save mcp-call node result
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
        mcpResult, // Include MCP request result
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
   * Determine node execution order.
   * Uses topological sort to determine DAG execution order.
   */
  private determineExecutionOrder(): string[] {
    const nodes = this.workflow.nodes;
    const edges = this.workflow.edges;

    // Build adjacency list
    const adjacencyList: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};

    // Initialize
    nodes.forEach((node) => {
      adjacencyList[node.id] = [];
      inDegree[node.id] = 0;
    });

    // Build adjacency list and in-degree from edges
    edges.forEach((edge) => {
      adjacencyList[edge.source].push(edge.target);
      inDegree[edge.target]++;
    });

    // Topological sort (Kahn's algorithm)
    const queue: string[] = [];
    const executionOrder: string[] = [];

    // Add nodes with in-degree 0 (start nodes) to queue
    Object.keys(inDegree).forEach((nodeId) => {
      if (inDegree[nodeId] === 0) {
        queue.push(nodeId);
      }
    });

    // Process via BFS
    while (queue.length > 0) {
      const currentNode = queue.shift()!;
      executionOrder.push(currentNode);

      // Decrement in-degree of adjacent nodes
      adjacencyList[currentNode].forEach((neighbor) => {
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) {
          queue.push(neighbor);
        }
      });
    }

    // Error if cycle detected
    if (executionOrder.length !== nodes.length) {
      throw new Error("Workflow contains a cycle");
    }

    return executionOrder;
  }

  /**
   * Execute an individual node
   */
  private async executeNode(
    node: WorkflowNode,
    context: any,
    previousResults: Record<string, any>,
  ): Promise<any> {
    console.log(`Executing node: ${node.id} (${node.type})`);

    switch (node.type) {
      case "start":
        // Start node - no operation
        return { started: true, timestamp: Date.now() };

      case "end":
        // End node - return final results
        return { completed: true, timestamp: Date.now(), previousResults };

      case "hook":
        // Execute hook node
        return await this.executeHookNode(node, context, previousResults);

      case "mcp-call":
        // MCP call node - execute the actual MCP request
        return await this.executeMcpCallNode(node, context, previousResults);

      default:
        console.warn(`Unknown node type: ${node.type}`);
        return { skipped: true, reason: `Unknown node type: ${node.type}` };
    }
  }

  /**
   * Execute an MCP call node
   */
  private async executeMcpCallNode(
    node: WorkflowNode,
    context: any,
    _previousResults: Record<string, any>,
  ): Promise<any> {
    console.log(`Executing MCP call node: ${node.id}`);

    // Get MCP handler from context
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
      // Execute MCP request
      console.log(`Executing MCP request: ${context.method}`);
      const mcpResponse = await mcpHandler();

      return {
        type: "mcp-call",
        success: true,
        mcpResponse, // Include MCP response
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
   * Execute a hook node
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

    // Build context for hook execution
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

      // If referencing a HookModule
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
        // Inline script
        scriptToExecute = hook.script;
      }

      if (scriptToExecute) {
        // Execute the script
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

      // Continue workflow execution even on error (configurable)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Execute pre-processing hooks (for future extension)
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
   * Execute post-processing hooks (for future extension)
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
   * Determine whether a node is a pre-processing hook (for future extension)
   */
  private isPreHook(node: WorkflowNode): boolean {
    // Check if directly connected from start node or before mcp-call node
    const startNode = this.workflow.nodes.find((n) => n.type === "start");
    if (!startNode) return false;

    const edgesFromStart = this.workflow.edges.filter(
      (e) => e.source === startNode.id,
    );
    return edgesFromStart.some((e) => e.target === node.id);
  }

  /**
   * Determine whether a node is a post-processing hook (for future extension)
   */
  private isPostHook(node: WorkflowNode): boolean {
    // Check if directly connected to end node or after mcp-call node
    const endNode = this.workflow.nodes.find((n) => n.type === "end");
    if (!endNode) return false;

    const edgesToEnd = this.workflow.edges.filter(
      (e) => e.target === endNode.id,
    );
    return edgesToEnd.some((e) => e.source === node.id);
  }
}
