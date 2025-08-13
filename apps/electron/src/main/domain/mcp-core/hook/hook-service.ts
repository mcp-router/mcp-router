import { SingletonService } from "@/main/application/core/singleton-service";
import {
  MCPHook,
  HookContext,
  HookResult,
  HookExecutionError,
} from "@mcp_router/shared";
import { getHookRepository } from "@/main/infrastructure/database";
import { logInfo, logError } from "@/main/utils/logger";
import vm from "vm";

/**
 * Hook Service for MCP Router
 * Manages pre/post hooks for MCP requests
 */
export class HookService extends SingletonService<
  MCPHook,
  string,
  HookService
> {
  private hooks: Map<string, MCPHook> = new Map();

  /**
   * Constructor
   */
  protected constructor() {
    super();
    this.loadHooks();
  }

  /**
   * Get entity name
   */
  protected getEntityName(): string {
    return "Hook";
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): HookService {
    return (this as any).getInstanceBase();
  }

  /**
   * Reset instance (used when switching workspaces)
   */
  public static resetInstance(): void {
    // Clear hooks before resetting instance
    try {
      const instance = HookService.getInstance();
      if (instance && instance instanceof HookService) {
        instance.hooks.clear();
      }
    } catch {
      // Instance might not exist yet
    }
    (this as any).resetInstanceBase(HookService);
  }

  /**
   * Load all hooks from database
   */
  private loadHooks(): void {
    try {
      const repository = getHookRepository();
      const hooks = repository.listHooks();
      this.hooks.clear();

      for (const hook of hooks) {
        this.hooks.set(hook.id, hook);
      }

      logInfo(`Loaded ${hooks.length} hooks`);
    } catch (error) {
      logError("Failed to load hooks", error);
    }
  }

  /**
   * Execute pre-hooks for a request
   */
  async executePreHooks(context: HookContext): Promise<HookResult> {
    const hooks = this.getApplicableHooks("pre");
    return this.executeHooks(hooks, context);
  }

  /**
   * Execute post-hooks for a response
   */
  async executePostHooks(context: HookContext): Promise<HookResult> {
    const hooks = this.getApplicableHooks("post");
    return this.executeHooks(hooks, context);
  }

  /**
   * Get applicable hooks based on type and context
   */
  private getApplicableHooks(type: "pre" | "post"): MCPHook[] {
    const applicableHooks: MCPHook[] = [];

    for (const hook of this.hooks.values()) {
      // Skip disabled hooks
      if (!hook.enabled) continue;

      // Check hook type
      if (hook.hookType !== type && hook.hookType !== "both") continue;

      // All filtering is now done in the hook script itself
      applicableHooks.push(hook);
    }

    // Sort by executionOrder (ascending)
    return applicableHooks.sort((a, b) => a.executionOrder - b.executionOrder);
  }

  /**
   * Execute a series of hooks
   */
  private async executeHooks(
    hooks: MCPHook[],
    context: HookContext,
  ): Promise<HookResult> {
    let currentContext = { ...context };

    for (const hook of hooks) {
      try {
        logInfo(`Executing hook: ${hook.name}`);

        const result = await this.executeScript(hook.script, currentContext);

        if (!result.continue) {
          logInfo(`Hook ${hook.name} halted execution`, {
            error: result.error,
          });
          return result;
        }

        // Update context if provided
        if (result.context) {
          currentContext = result.context;
        }
      } catch (error) {
        const executionError: HookExecutionError = {
          hookId: hook.id,
          hookName: hook.name,
          error: error as Error,
          timestamp: Date.now(),
        };

        logError(`Hook execution failed: ${hook.name}`, executionError);

        // Continue execution even if a hook fails
        // TODO: Make this configurable
      }
    }

    return { continue: true, context: currentContext };
  }

  /**
   * Execute a hook script in a sandboxed environment
   */
  private async executeScript(
    script: string,
    context: HookContext,
  ): Promise<HookResult> {
    // Create a sandboxed context
    const sandbox = {
      context: { ...context },
      console: {
        log: (...args: any[]) => logInfo(`[Hook Script]`, ...args),
        info: (...args: any[]) => logInfo(`[Hook Script]`, ...args),
        warn: (...args: any[]) => logInfo(`[Hook Script] [WARN]`, ...args),
        error: (...args: any[]) => logError(`[Hook Script]`, ...args),
      },
      // Utility functions
      sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
      // HTTP fetch function with restrictions
      fetch: async (url: string, options?: any) => {
        try {
          // Validate URL - only allow HTTPS
          const parsedUrl = new URL(url);
          if (parsedUrl.protocol !== "https:") {
            throw new Error("Only HTTPS URLs are allowed");
          }

          // Import fetch dynamically (Node.js 18+)
          const { default: fetch } = await import("node-fetch");

          // Limit request options for security
          const safeOptions = {
            method: options?.method || "GET",
            headers: options?.headers || {},
            ...(options?.body && { body: options.body }),
            // Force timeout to prevent hanging requests
            signal: AbortSignal.timeout(10000), // 10 second timeout
          };
          // Remove potentially dangerous headers
          delete safeOptions.headers["cookie"];
          delete safeOptions.headers["authorization"];

          const response = await fetch(url, safeOptions);

          // Return a simplified response object
          return {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            text: async () => response.text(),
            json: async () => response.json(),
          };
        } catch (error) {
          logError(`[Hook Script] Fetch error:`, error);
          throw error;
        }
      },
      // Result object to be populated by the script
      __result: null as HookResult | null,
    };

    // Wrap the script to capture the return value
    const wrappedScript = `
      (async function() {
        ${script}
      })().then(result => {
        __result = result;
      }).catch(error => {
        __result = {
          continue: false,
          error: {
            code: 'SCRIPT_ERROR',
            message: error.message || 'Script execution failed'
          }
        };
      });
    `;

    try {
      // Create and run the script
      const scriptObj = new vm.Script(wrappedScript);
      const contextObj = vm.createContext(sandbox);

      // Set execution timeout (5 seconds)
      const timeout = 5000;
      await scriptObj.runInContext(contextObj, { timeout });

      // Wait for async execution to complete
      let attempts = 0;
      while (sandbox.__result === null && attempts < 50) {
        await this.sleep(100);
        attempts++;
      }

      if (sandbox.__result === null) {
        return {
          continue: false,
          error: {
            code: "TIMEOUT",
            message: "Script execution timed out",
          },
        };
      }

      return sandbox.__result;
    } catch (error) {
      logError("Script execution error", error);
      return {
        continue: false,
        error: {
          code: "EXECUTION_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  /**
   * Helper sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Reload hooks from database
   */
  reloadHooks(): void {
    this.loadHooks();
  }

  /**
   * Add or update a hook
   */
  upsertHook(hook: MCPHook): void {
    try {
      const repository = getHookRepository();
      repository.upsertHook(hook);
      this.hooks.set(hook.id, hook);
    } catch (error) {
      this.handleError("upsert", error);
    }
  }

  /**
   * Delete a hook
   */
  deleteHook(id: string): void {
    try {
      const repository = getHookRepository();
      repository.deleteHook(id);
      this.hooks.delete(id);
    } catch (error) {
      this.handleError("delete", error);
    }
  }

  /**
   * Enable/disable a hook
   */
  setHookEnabled(id: string, enabled: boolean): void {
    try {
      const hook = this.hooks.get(id);
      if (!hook) {
        throw new Error(`Hook not found: ${id}`);
      }

      hook.enabled = enabled;
      const repository = getHookRepository();
      repository.updateHook(id, { enabled });
    } catch (error) {
      this.handleError("update", error);
    }
  }

  /**
   * List all hooks
   */
  listHooks(): MCPHook[] {
    try {
      const repository = getHookRepository();
      return repository.listHooks();
    } catch (error) {
      return this.handleError("list", error, []);
    }
  }

  /**
   * Get hook by ID
   */
  getHookById(id: string): MCPHook | null {
    try {
      const repository = getHookRepository();
      return repository.getHook(id);
    } catch (error) {
      return this.handleError("get", error, null);
    }
  }
}

/**
 * Get singleton instance of HookService
 */
export function getHookService(): HookService {
  return HookService.getInstance();
}
