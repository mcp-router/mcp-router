import {
  MCPHook,
  HookContext,
  HookResult,
  HookExecutionError,
} from "@mcp_router/shared";
import { DatabaseService } from "@/main/infrastructure/database";
import { HookRepository } from "@/main/infrastructure/database/repositories/hook/hook-repository";
import { RepositoryFactory } from "@/main/infrastructure/database/factories/repository-factory";
import { McpLogger } from "./logging";
import vm from "vm";

/**
 * Hook Manager for MCP Router
 * Manages pre/post hooks for MCP requests
 */
export class HookManager {
  private hooks: Map<string, MCPHook> = new Map();
  private hookRepository: HookRepository;
  private logger: McpLogger;

  constructor(
    private databaseService: DatabaseService,
    logger: McpLogger,
  ) {
    this.logger = logger;
    this.hookRepository = RepositoryFactory.getHookRepository(databaseService);
    this.loadHooks();
  }

  /**
   * Load all hooks from database
   */
  private async loadHooks(): Promise<void> {
    try {
      const hooks = await this.hookRepository.listHooks();
      this.hooks.clear();

      for (const hook of hooks) {
        this.hooks.set(hook.id, hook);
      }

      this.logger.info(`Loaded ${hooks.length} hooks`);
    } catch (error) {
      this.logger.error("Failed to load hooks", error);
    }
  }

  /**
   * Execute pre-hooks for a request
   */
  async executePreHooks(context: HookContext): Promise<HookResult> {
    const hooks = this.getApplicableHooks("pre", context);
    return this.executeHooks(hooks, context);
  }

  /**
   * Execute post-hooks for a response
   */
  async executePostHooks(context: HookContext): Promise<HookResult> {
    const hooks = this.getApplicableHooks("post", context);
    return this.executeHooks(hooks, context);
  }

  /**
   * Get applicable hooks based on type and context
   */
  private getApplicableHooks(
    type: "pre" | "post",
    context: HookContext,
  ): MCPHook[] {
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
        this.logger.debug(`Executing hook: ${hook.name}`);

        const result = await this.executeScript(hook.script, currentContext);

        if (!result.continue) {
          this.logger.info(`Hook ${hook.name} halted execution`, {
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

        this.logger.error(
          `Hook execution failed: ${hook.name}`,
          executionError,
        );

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
        log: (...args: any[]) => this.logger.info(`[Hook Script]`, ...args),
        info: (...args: any[]) => this.logger.info(`[Hook Script]`, ...args),
        warn: (...args: any[]) => this.logger.warn(`[Hook Script]`, ...args),
        error: (...args: any[]) => this.logger.error(`[Hook Script]`, ...args),
      },
      // Utility functions
      sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
      validateToken: (token: string) => {
        // TODO: Implement actual token validation
        return token && token.length > 0;
      },
      getServerInfo: (serverId: string) => {
        // TODO: Implement server info retrieval
        return { id: serverId, name: context.serverName };
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
      this.logger.error("Script execution error", error);
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
  async reloadHooks(): Promise<void> {
    await this.loadHooks();
  }

  /**
   * Add or update a hook
   */
  async upsertHook(hook: MCPHook): Promise<void> {
    await this.hookRepository.upsertHook(hook);
    this.hooks.set(hook.id, hook);
  }

  /**
   * Delete a hook
   */
  async deleteHook(id: string): Promise<void> {
    await this.hookRepository.deleteHook(id);
    this.hooks.delete(id);
  }

  /**
   * Enable/disable a hook
   */
  async setHookEnabled(id: string, enabled: boolean): Promise<void> {
    const hook = this.hooks.get(id);
    if (!hook) {
      throw new Error(`Hook not found: ${id}`);
    }

    hook.enabled = enabled;
    await this.hookRepository.updateHook(id, { enabled });
  }

  /**
   * Test a hook with a sample context
   */
  async testHook(id: string, context: HookContext): Promise<HookResult> {
    const hook = this.hooks.get(id);
    if (!hook) {
      throw new Error(`Hook not found: ${id}`);
    }

    return this.executeScript(hook.script, context);
  }
}
