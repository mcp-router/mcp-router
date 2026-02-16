import { HookModule } from "@mcp_router/shared";
import { getHookRepository, HookRepository } from "./hook.repository";
import { getServerService } from "@/main/modules/mcp-server-manager/server-service";
import vm from "vm";

/**
 * Hook Module domain service.
 * Provides business logic and backend services for Hook Modules.
 */
export class HookService {
  private static instance: HookService | null = null;
  private repository: HookRepository;

  private constructor() {
    this.repository = getHookRepository();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): HookService {
    if (!HookService.instance) {
      HookService.instance = new HookService();
    }
    return HookService.instance;
  }

  /**
   * Reset the instance (for testing)
   */
  public static resetInstance(): void {
    HookService.instance = null;
  }

  /**
   * Get all Hook Modules
   */
  public async getAllHookModules(): Promise<HookModule[]> {
    return this.repository.getAllHookModules();
  }

  /**
   * Get a Hook Module by ID
   */
  public async getHookModuleById(id: string): Promise<HookModule | null> {
    return this.repository.getHookModuleById(id);
  }

  /**
   * Get a Hook Module by name
   */
  public async getHookModuleByName(name: string): Promise<HookModule | null> {
    return this.repository.getHookModuleByName(name);
  }

  /**
   * Create a Hook Module
   */
  public async createHookModule(
    module: Omit<HookModule, "id">,
  ): Promise<HookModule> {
    // Validate
    this.validateHookModule(module);

    // Syntax check the script
    const validation = await this.validateHookScript(module.script);
    if (!validation.valid) {
      throw new Error(`Invalid hook script: ${validation.error}`);
    }

    return this.repository.createHookModule(module);
  }

  /**
   * Update a Hook Module
   */
  public async updateHookModule(
    id: string,
    updates: Partial<Omit<HookModule, "id">>,
  ): Promise<HookModule | null> {
    // Validate script if being updated
    if (updates.script) {
      const validation = await this.validateHookScript(updates.script);
      if (!validation.valid) {
        throw new Error(`Invalid hook script: ${validation.error}`);
      }
    }

    // Check for duplicate name if name is being updated
    if (updates.name) {
      const existing = await this.getHookModuleByName(updates.name);
      if (existing && existing.id !== id) {
        throw new Error(
          `Hook module with name "${updates.name}" already exists`,
        );
      }
    }

    return this.repository.updateHookModule(id, updates);
  }

  /**
   * Delete a Hook Module
   */
  public async deleteHookModule(id: string): Promise<boolean> {
    // Check if this HookModule is used in any Workflow
    const { WorkflowService } = await import("./workflow.service");
    const workflowService = WorkflowService.getInstance();
    const workflows = await workflowService.getAllWorkflows();

    // Find workflows using this module
    const usingWorkflows: string[] = [];
    for (const workflow of workflows) {
      for (const node of workflow.nodes) {
        if (node.type === "hook") {
          const hook = node.data?.hook as any;
          if (hook?.hookModuleId === id) {
            usingWorkflows.push(workflow.name);
          }
        }
      }
    }

    // Throw error if in use
    if (usingWorkflows.length > 0) {
      throw new Error(
        `Cannot delete hook module. It is used by workflow(s): ${usingWorkflows.join(", ")}`,
      );
    }

    return this.repository.deleteHookModule(id);
  }

  /**
   * Import a Hook Module (avoiding name duplicates)
   */
  public async importHookModule(
    module: Omit<HookModule, "id">,
  ): Promise<HookModule> {
    // Validate
    this.validateHookModule(module);

    // Syntax check the script
    const validation = await this.validateHookScript(module.script);
    if (!validation.valid) {
      throw new Error(`Invalid hook script: ${validation.error}`);
    }

    return this.repository.importHookModule(module);
  }

  /**
   * Execute a Hook Module (for testing)
   */
  public async executeHookModule(id: string, context: any): Promise<any> {
    const module = await this.getHookModuleById(id);
    if (!module) {
      throw new Error(`Hook module not found: ${id}`);
    }

    return this.executeHookScript(module.script, context);
  }

  /**
   * Execute a hook script
   */
  public async executeHookScript(script: string, context: any): Promise<any> {
    try {
      // Create sandbox environment
      const sandbox = {
        context,
        console: {
          log: (...args: any[]) => console.log(`[Hook]`, ...args),
          error: (...args: any[]) => console.error(`[Hook]`, ...args),
          warn: (...args: any[]) => console.warn(`[Hook]`, ...args),
        },
        // Utility functions
        sleep: (ms: number): Promise<void> => {
          const capped = Math.min(Math.max(0, ms), 5000);
          return new Promise((resolve) => setTimeout(resolve, capped));
        },
        getServerInfo: (
          serverId: string,
        ): {
          id: string;
          name: string;
          type: string;
          status: string;
          enabled: boolean;
        } | null => {
          try {
            const server = getServerService().getServerById(serverId);
            if (!server) return null;
            return {
              id: server.id,
              name: server.name,
              type: server.serverType,
              status: server.status,
              enabled: !server.disabled,
            };
          } catch {
            return null;
          }
        },
        // Global objects
        JSON,
        Object,
        Array,
        String,
        Number,
        Boolean,
        Date,
        Math,
      };

      // Wrap script to capture return value
      const wrappedScript = `
        (async function() {
          ${script}
        })()
      `;

      // Execute script in VM context
      const vmScript = new vm.Script(wrappedScript);
      const vmContext = vm.createContext(sandbox);

      // Set timeout (5 seconds)
      const result = await vmScript.runInContext(vmContext, {
        timeout: 5000,
        displayErrors: true,
      });

      return result;
    } catch (error: any) {
      console.error("Hook execution error:", error);
      throw new Error(`Hook execution failed: ${error.message}`);
    }
  }

  /**
   * Validate a hook script
   */
  public async validateHookScript(
    script: string,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      // Syntax check only (no execution)
      new vm.Script(script);
      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        error: error.message || "Invalid JavaScript syntax",
      };
    }
  }

  /**
   * Validate a Hook Module
   */
  private validateHookModule(module: any): void {
    if (!module.name || module.name.trim().length === 0) {
      throw new Error("Hook module name is required");
    }

    if (!module.script || module.script.trim().length === 0) {
      throw new Error("Hook module script is required");
    }

    // Name length limit
    if (module.name.length > 100) {
      throw new Error("Hook module name is too long (max 100 characters)");
    }

    // Script size limit (1MB)
    if (module.script.length > 1024 * 1024) {
      throw new Error("Hook module script is too large (max 1MB)");
    }
  }
}

/**
 * Get the singleton instance of HookService
 */
export function getHookService(): HookService {
  return HookService.getInstance();
}
