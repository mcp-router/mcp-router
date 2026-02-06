import { WorkflowDefinition } from "@mcp_router/shared";
import {
  getWorkflowRepository,
  WorkflowRepository,
} from "./workflow.repository";

/**
 * Workflow domain service.
 * Provides business logic and backend services for Workflows.
 */
export class WorkflowService {
  private static instance: WorkflowService | null = null;
  private repository: WorkflowRepository;

  private constructor() {
    this.repository = getWorkflowRepository();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): WorkflowService {
    if (!WorkflowService.instance) {
      WorkflowService.instance = new WorkflowService();
    }
    return WorkflowService.instance;
  }

  /**
   * Reset the instance (for testing)
   */
  public static resetInstance(): void {
    WorkflowService.instance = null;
  }

  /**
   * Get all workflows
   */
  public async getAllWorkflows(): Promise<WorkflowDefinition[]> {
    return this.repository.getAllWorkflows();
  }

  /**
   * Get only enabled workflows
   */
  public async getEnabledWorkflows(): Promise<WorkflowDefinition[]> {
    return this.repository.getEnabledWorkflows();
  }

  /**
   * Get a workflow by ID
   */
  public async getWorkflowById(id: string): Promise<WorkflowDefinition | null> {
    return this.repository.getWorkflowById(id);
  }

  /**
   * Get workflows by type
   */
  public async getWorkflowsByType(
    workflowType: string,
  ): Promise<WorkflowDefinition[]> {
    return this.repository.getWorkflowsByType(workflowType);
  }

  /**
   * Create a workflow
   */
  public async createWorkflow(
    workflow: Omit<WorkflowDefinition, "id" | "createdAt" | "updatedAt">,
  ): Promise<WorkflowDefinition> {
    // Validate
    this.validateWorkflow(workflow);

    return this.repository.createWorkflow(workflow);
  }

  /**
   * Update a workflow
   */
  public async updateWorkflow(
    id: string,
    updates: Partial<Omit<WorkflowDefinition, "id" | "createdAt">>,
  ): Promise<WorkflowDefinition | null> {
    // Partial validation
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
   * Enable the specified workflow and disable other workflows of the same type
   */
  public async setActiveWorkflow(id: string): Promise<boolean> {
    // Get the workflow
    const workflow = await this.getWorkflowById(id);
    if (!workflow) {
      throw new Error(`Workflow not found: ${id}`);
    }

    // Validate with WorkflowExecutor
    const { WorkflowExecutor } = await import("./workflow-executor");
    const isValid = WorkflowExecutor.isValidWorkflow(workflow);

    if (!isValid) {
      throw new Error(
        `Workflow "${workflow.name}" is not valid. ` +
          `Ensure it has Start -> MCP Call -> End nodes properly connected.`,
      );
    }

    // Only enable valid workflows
    return this.repository.setActiveWorkflow(id);
  }

  /**
   * Disable a workflow
   */
  public async disableWorkflow(id: string): Promise<boolean> {
    return this.repository.disableWorkflow(id);
  }

  /**
   * Delete a workflow
   */
  public async deleteWorkflow(id: string): Promise<boolean> {
    return this.repository.deleteWorkflow(id);
  }

  /**
   * Execute a workflow
   * TODO: To be moved to WorkflowExecutor class
   */
  public async executeWorkflow(id: string, context?: any): Promise<any> {
    const workflow = await this.getWorkflowById(id);
    if (!workflow) {
      throw new Error(`Workflow not found: ${id}`);
    }

    if (!workflow.enabled) {
      throw new Error(`Workflow is disabled: ${id}`);
    }

    // Execute using WorkflowExecutor
    const { WorkflowExecutor } = await import("./workflow-executor");
    const executor = new WorkflowExecutor(workflow);

    try {
      const result = await executor.execute(context);
      console.log(`Workflow executed successfully: ${workflow.name}`, result);
      return result;
    } catch (error) {
      console.error(`Failed to execute workflow: ${workflow.name}`, error);
      throw error;
    }
  }

  /**
   * Validate a workflow
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

    // Check for start node
    const hasStartNode = workflow.nodes.some(
      (node: any) => node.type === "start",
    );
    if (!hasStartNode) {
      throw new Error("Workflow must have a start node");
    }

    // Check for end node
    const hasEndNode = workflow.nodes.some((node: any) => node.type === "end");
    if (!hasEndNode) {
      throw new Error("Workflow must have an end node");
    }
  }
}

/**
 * Get the singleton instance of WorkflowService
 */
export function getWorkflowService(): WorkflowService {
  return WorkflowService.getInstance();
}
