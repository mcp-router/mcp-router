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
      // Build a hardened sandbox that prevents constructor-chain escape.
      // Node's `vm` module is NOT a security boundary — any exposed object
      // with a live prototype can be used to reach `Function` via
      //   obj.constructor.constructor('return process')()
      // We mitigate this by:
      //  1. Exposing only plain objects with static utility methods (no real
      //     constructors).
      //  2. Deep-freezing every sandbox value so prototypes can't be mutated.
      //  3. Wrapping the user-supplied `context` in a recursive proxy that
      //     blocks access to `constructor` and `__proto__` at every level.

      const sandbox = createHardenedSandbox(context);

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

// ---------------------------------------------------------------------------
// Sandbox hardening utilities
// ---------------------------------------------------------------------------

/** Property names that could be used to traverse the prototype/constructor chain */
const BLOCKED_PROPS = new Set(["constructor", "__proto__", "prototype"]);

/**
 * Recursively wraps an object in a Proxy that blocks access to
 * `constructor`, `__proto__`, and `prototype` at every depth.
 * Primitive values are returned as-is.  Functions are wrapped so their
 * return values are also proxied.
 */
function sandboxProxy(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value;

  const t = typeof value;
  // Primitives pass through unchanged
  if (t !== "object" && t !== "function") return value;

  const obj = value as object;
  if (seen.has(obj)) return obj; // avoid infinite loops on cycles
  seen.add(obj);

  return new Proxy(obj, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && BLOCKED_PROPS.has(prop)) {
        return undefined;
      }
      const val = Reflect.get(target, prop, receiver);
      // Recursively proxy nested objects/functions
      if (val !== null && val !== undefined && (typeof val === "object" || typeof val === "function")) {
        return sandboxProxy(val, seen);
      }
      return val;
    },
    // Block setting dangerous props
    set(target, prop, val, receiver) {
      if (typeof prop === "string" && BLOCKED_PROPS.has(prop)) {
        return true; // silently fail
      }
      return Reflect.set(target, prop, val, receiver);
    },
  });
}

/**
 * Deep-freeze an object and its entire prototype chain so that
 * no property can be added, removed, or reconfigured.
 */
function deepFreeze<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object" && typeof obj !== "function") return obj;

  Object.freeze(obj);
  const proto = Object.getPrototypeOf(obj);
  if (proto && proto !== Object.prototype && proto !== Function.prototype) {
    deepFreeze(proto);
  }
  for (const value of Object.values(obj as Record<string, unknown>)) {
    if (value && (typeof value === "object" || typeof value === "function")) {
      deepFreeze(value);
    }
  }
  return obj;
}

/**
 * Build a hardened sandbox object for VM execution.
 *
 * Instead of exposing real built-in constructors (JSON, Object, Array …)
 * which let scripts traverse the prototype chain to reach `Function`, we
 * expose **plain frozen objects** containing only the safe static methods.
 *
 * The user-supplied `context` is wrapped in a recursive proxy that blocks
 * access to `constructor`, `__proto__`, and `prototype` at any depth.
 */
function createHardenedSandbox(context: unknown): Record<string, unknown> {
  // --- Safe built-in replacements (plain objects, no live constructors) ---
  const safeJSON = Object.create(null) as Record<string, unknown>;
  safeJSON.parse = JSON.parse.bind(JSON);
  safeJSON.stringify = JSON.stringify.bind(JSON);

  const safeObject = Object.create(null) as Record<string, unknown>;
  safeObject.keys = Object.keys;
  safeObject.values = Object.values;
  safeObject.entries = Object.entries;
  safeObject.assign = Object.assign;
  safeObject.freeze = Object.freeze;
  safeObject.create = Object.create;
  safeObject.defineProperty = Object.defineProperty;

  const safeArray = Object.create(null) as Record<string, unknown>;
  safeArray.isArray = Array.isArray;
  safeArray.from = Array.from;
  safeArray.of = Array.of;

  const safeNumber = Object.create(null) as Record<string, unknown>;
  safeNumber.isFinite = Number.isFinite;
  safeNumber.isInteger = Number.isInteger;
  safeNumber.isNaN = Number.isNaN;
  safeNumber.parseFloat = Number.parseFloat;
  safeNumber.parseInt = Number.parseInt;
  safeNumber.MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;
  safeNumber.MIN_SAFE_INTEGER = Number.MIN_SAFE_INTEGER;

  const safeDate = Object.create(null) as Record<string, unknown>;
  safeDate.now = Date.now;

  // Math is already a plain namespace object, but clone it to sever the
  // prototype chain. Use Object.create(null) to avoid Object.prototype.
  const safeMath = Object.create(null) as Record<string, unknown>;
  for (const key of Object.getOwnPropertyNames(Math)) {
    if (key === "constructor") continue;
    const desc = Object.getOwnPropertyDescriptor(Math, key);
    if (desc) Object.defineProperty(safeMath, key, desc);
  }

  // Safe console that cannot be used to escape
  const safeConsole = Object.create(null) as Record<string, unknown>;
  safeConsole.log = (...args: unknown[]) => console.log("[Hook]", ...args);
  safeConsole.error = (...args: unknown[]) => console.error("[Hook]", ...args);
  safeConsole.warn = (...args: unknown[]) => console.warn("[Hook]", ...args);

  // --- Utility helpers ---
  const sleep = (ms: number): Promise<void> => {
    const capped = Math.min(Math.max(0, ms), 5000);
    return new Promise((resolve) => setTimeout(resolve, capped));
  };

  const getServerInfo = (
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
      return Object.freeze({
        id: server.id,
        name: server.name,
        type: server.serverType,
        status: server.status,
        enabled: !server.disabled,
      });
    } catch {
      return null;
    }
  };

  // --- Freeze all safe built-ins ---
  const builtins = [safeJSON, safeObject, safeArray, safeNumber, safeDate, safeMath, safeConsole];
  for (const obj of builtins) {
    deepFreeze(obj);
  }

  // --- Assemble sandbox ---
  // The user `context` is proxy-wrapped so scripts cannot traverse its
  // prototype chain to reach host constructors.
  const sandbox: Record<string, unknown> = {
    context: sandboxProxy(context),
    console: safeConsole,
    sleep,
    getServerInfo,
    // Provide a frozen empty String / Boolean so scripts can reference them
    // (e.g. typeof checks) without gaining access to the real constructors.
    JSON: safeJSON,
    Object: safeObject,
    Array: safeArray,
    String: Object.freeze(Object.create(null)),
    Number: safeNumber,
    Boolean: Object.freeze(Object.create(null)),
    Date: safeDate,
    Math: safeMath,
  };

  return sandbox;
}

/**
 * Get the singleton instance of HookService
 */
export function getHookService(): HookService {
  return HookService.getInstance();
}
