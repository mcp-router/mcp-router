import { HookModule } from "@mcp_router/shared";
import { getHookRepository, HookRepository } from "./hook.repository";
import { getServerService } from "@/main/modules/mcp-server-manager/server-service";
import ivm from "isolated-vm";

/**
 * Hook Module domain service.
 * Provides business logic and backend services for Hook Modules.
 *
 * Hook scripts are executed inside truly isolated V8 contexts via the
 * `isolated-vm` package. Each execution gets its own Isolate with a
 * separate heap (128 MB limit) and a 5-second execution timeout.
 * This replaces the previous Node.js `vm` module approach, which could
 * not guarantee isolation (Node.js docs explicitly state `vm` is NOT a
 * security boundary).
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
   * Execute a hook script inside an isolated V8 context.
   *
   * Each invocation creates a fresh `ivm.Isolate` (128 MB heap limit) and
   * context so that user-supplied code cannot access Node.js globals,
   * require(), process, or any host objects.  Utility functions (console,
   * sleep, getServerInfo) are transferred into the isolate via callbacks.
   */
  public async executeHookScript(script: string, context: any): Promise<any> {
    const isolate = new ivm.Isolate({ memoryLimit: 128 });
    try {
      const ivmContext = await isolate.createContext();
      const jail = ivmContext.global;

      // Make `global` reference itself (standard pattern for isolated-vm)
      await jail.set("global", jail.derefInto());

      // --- Transfer the user-supplied context as a deep copy ---
      await jail.set("context", new ivm.ExternalCopy(context ?? {}).copyInto());

      // --- Console (callbacks into the host) ---
      await jail.set("__consoleLog", new ivm.Callback(
        (...args: unknown[]) => console.log("[Hook]", ...args),
      ));
      await jail.set("__consoleError", new ivm.Callback(
        (...args: unknown[]) => console.error("[Hook]", ...args),
      ));
      await jail.set("__consoleWarn", new ivm.Callback(
        (...args: unknown[]) => console.warn("[Hook]", ...args),
      ));

      // --- sleep (returns a promise that resolves on the host side) ---
      await jail.set("__sleep", new ivm.Callback(
        (ms: number) => {
          const capped = Math.min(Math.max(0, Number(ms) || 0), 5000);
          return new Promise<void>((resolve) => setTimeout(resolve, capped));
        },
        { async: true },
      ));

      // --- getServerInfo (synchronous callback into host) ---
      await jail.set("__getServerInfo", new ivm.Callback(
        (serverId: string): string | null => {
          try {
            const server = getServerService().getServerById(String(serverId));
            if (!server) return null;
            return JSON.stringify({
              id: server.id,
              name: server.name,
              type: server.serverType,
              status: server.status,
              enabled: !server.disabled,
            });
          } catch {
            return null;
          }
        },
      ));

      // --- Bootstrap: wire up friendly APIs from the raw callbacks ---
      const bootstrap = await isolate.compileScript(`
        (function() {
          const console = {
            log:   (...args) => __consoleLog(...args),
            error: (...args) => __consoleError(...args),
            warn:  (...args) => __consoleWarn(...args),
          };
          global.console = console;

          global.sleep = function sleep(ms) {
            return __sleep(ms);
          };

          global.getServerInfo = function getServerInfo(serverId) {
            const raw = __getServerInfo(serverId);
            return raw ? JSON.parse(raw) : null;
          };

          // Clean up raw callbacks from global scope
          delete global.__consoleLog;
          delete global.__consoleError;
          delete global.__consoleWarn;
          delete global.__sleep;
          delete global.__getServerInfo;
        })();
      `);
      await bootstrap.run(ivmContext);

      // --- Compile and run the user script ---
      const wrappedScript = `
        (async function() {
          ${script}
        })()
      `;

      const compiled = await isolate.compileScript(wrappedScript);
      const result = await compiled.run(ivmContext, { timeout: 5000 });

      return result;
    } catch (error: any) {
      console.error("Hook execution error:", error);
      throw new Error(`Hook execution failed: ${error.message}`);
    } finally {
      // Always dispose the isolate to free the V8 heap
      if (!isolate.isDisposed) {
        isolate.dispose();
      }
    }
  }

  /**
   * Validate a hook script (syntax check only, no execution).
   *
   * Creates a disposable isolate just to attempt compilation.
   */
  public async validateHookScript(
    script: string,
  ): Promise<{ valid: boolean; error?: string }> {
    const isolate = new ivm.Isolate({ memoryLimit: 8 });
    try {
      await isolate.compileScript(script);
      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        error: error.message || "Invalid JavaScript syntax",
      };
    } finally {
      if (!isolate.isDisposed) {
        isolate.dispose();
      }
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
