/**
 * Workflow and Hook Module API interface
 */

import { WorkflowDefinition, HookModule } from "../../workflow-types";

/**
 * Workflow management API
 */
export interface WorkflowAPI {
  // Workflow operations
  workflows: {
    list: () => Promise<WorkflowDefinition[]>;
    get: (id: string) => Promise<WorkflowDefinition | null>;
    create: (
      workflow: Omit<WorkflowDefinition, "id" | "createdAt" | "updatedAt">,
    ) => Promise<WorkflowDefinition>;
    update: (
      id: string,
      updates: Partial<Omit<WorkflowDefinition, "id" | "createdAt">>,
    ) => Promise<WorkflowDefinition | null>;
    delete: (id: string) => Promise<boolean>;
    setActive: (id: string) => Promise<boolean>;
    disable: (id: string) => Promise<boolean>;
    execute: (id: string, context?: any) => Promise<any>;
    listEnabled: () => Promise<WorkflowDefinition[]>;
    listByType: (workflowType: string) => Promise<WorkflowDefinition[]>;
  };

  // Hook Module operations
  hooks: {
    list: () => Promise<HookModule[]>;
    get: (id: string) => Promise<HookModule | null>;
    create: (module: Omit<HookModule, "id">) => Promise<HookModule>;
    update: (
      id: string,
      updates: Partial<Omit<HookModule, "id">>,
    ) => Promise<HookModule | null>;
    delete: (id: string) => Promise<boolean>;
    execute: (id: string, context: any) => Promise<any>;
    import: (module: Omit<HookModule, "id">) => Promise<HookModule>;
    validate: (script: string) => Promise<{ valid: boolean; error?: string }>;
  };
}
