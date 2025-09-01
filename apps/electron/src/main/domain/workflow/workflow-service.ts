import { WorkflowDefinition } from "@mcp_router/shared";
import {
  getWorkflowRepository,
  WorkflowRepository,
} from "../../infrastructure/database/repositories/workflow/workflow-repository";

/**
 * Workflowドメインサービス
 * Workflowのビジネスロジックとバックエンドサービスを提供
 */
export class WorkflowService {
  private static instance: WorkflowService | null = null;
  private repository: WorkflowRepository;

  private constructor() {
    this.repository = getWorkflowRepository();
  }

  /**
   * シングルトンインスタンスの取得
   */
  public static getInstance(): WorkflowService {
    if (!WorkflowService.instance) {
      WorkflowService.instance = new WorkflowService();
    }
    return WorkflowService.instance;
  }

  /**
   * テスト用にインスタンスをリセット
   */
  public static resetInstance(): void {
    WorkflowService.instance = null;
  }

  /**
   * 全てのワークフローを取得
   */
  public async getAllWorkflows(): Promise<WorkflowDefinition[]> {
    return this.repository.getAllWorkflows();
  }

  /**
   * 有効なワークフローのみを取得
   */
  public async getEnabledWorkflows(): Promise<WorkflowDefinition[]> {
    return this.repository.getEnabledWorkflows();
  }

  /**
   * IDでワークフローを取得
   */
  public async getWorkflowById(id: string): Promise<WorkflowDefinition | null> {
    return this.repository.getWorkflowById(id);
  }

  /**
   * タイプ別にワークフローを取得
   */
  public async getWorkflowsByType(
    workflowType: string,
  ): Promise<WorkflowDefinition[]> {
    return this.repository.getWorkflowsByType(workflowType);
  }

  /**
   * ワークフローを作成
   */
  public async createWorkflow(
    workflow: Omit<WorkflowDefinition, "id" | "createdAt" | "updatedAt">,
  ): Promise<WorkflowDefinition> {
    // バリデーション
    this.validateWorkflow(workflow);

    return this.repository.createWorkflow(workflow);
  }

  /**
   * ワークフローを更新
   */
  public async updateWorkflow(
    id: string,
    updates: Partial<Omit<WorkflowDefinition, "id" | "createdAt">>,
  ): Promise<WorkflowDefinition | null> {
    // 部分的なバリデーション
    if (updates.nodes !== undefined || updates.edges !== undefined) {
      const existing = await this.getWorkflowById(id);
      if (existing) {
        const merged = { ...existing, ...updates };
        this.validateWorkflow(merged);
      }
    }

    return this.repository.updateWorkflow(id, updates);
  }

  /**
   * 指定したワークフローを有効化し、同じタイプの他のワークフローを無効化
   */
  public async setActiveWorkflow(id: string): Promise<boolean> {
    return this.repository.setActiveWorkflow(id);
  }

  /**
   * 指定したワークフローを無効化
   */
  public async disableWorkflow(id: string): Promise<boolean> {
    return this.repository.disableWorkflow(id);
  }

  /**
   * ワークフローを削除
   */
  public async deleteWorkflow(id: string): Promise<boolean> {
    return this.repository.deleteWorkflow(id);
  }

  /**
   * ワークフローを実行
   * TODO: WorkflowExecutorクラスに移動予定
   */
  public async executeWorkflow(id: string, context?: any): Promise<any> {
    const workflow = await this.getWorkflowById(id);
    if (!workflow) {
      throw new Error(`Workflow not found: ${id}`);
    }

    if (!workflow.enabled) {
      throw new Error(`Workflow is disabled: ${id}`);
    }

    // TODO: WorkflowExecutorクラスで実装
    console.log(`Executing workflow: ${workflow.name}`, context);

    // 仮の実装
    return {
      workflowId: id,
      status: "completed",
      executedAt: Date.now(),
      context,
    };
  }

  /**
   * ワークフローのバリデーション
   */
  private validateWorkflow(workflow: any): void {
    if (!workflow.name || workflow.name.trim().length === 0) {
      throw new Error("Workflow name is required");
    }

    if (!workflow.workflowType) {
      throw new Error("Workflow type is required");
    }

    if (!Array.isArray(workflow.nodes) || workflow.nodes.length === 0) {
      throw new Error("Workflow must have at least one node");
    }

    if (!Array.isArray(workflow.edges)) {
      throw new Error("Workflow edges must be an array");
    }

    // スタートノードの存在確認
    const hasStartNode = workflow.nodes.some(
      (node: any) => node.type === "start",
    );
    if (!hasStartNode) {
      throw new Error("Workflow must have a start node");
    }

    // エンドノードの存在確認
    const hasEndNode = workflow.nodes.some((node: any) => node.type === "end");
    if (!hasEndNode) {
      throw new Error("Workflow must have an end node");
    }
  }
}

/**
 * WorkflowServiceのシングルトンインスタンスを取得
 */
export function getWorkflowService(): WorkflowService {
  return WorkflowService.getInstance();
}
