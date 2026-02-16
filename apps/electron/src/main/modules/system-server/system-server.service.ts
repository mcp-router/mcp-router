import type { MCPServerManager } from "@/main/modules/mcp-server-manager/mcp-server-manager";
import { SystemServer } from "./system-server";

/**
 * Service that manages the SystemServer lifecycle.
 *
 * Unlike most services in this codebase the SystemServer is not a
 * workspace-scoped singleton — it is tied to the MCPServerManager
 * which already handles workspace switching. We keep a simple module-level
 * singleton here.
 */
let instance: SystemServerService | null = null;

export class SystemServerService {
  private systemServer: SystemServer;

  private constructor(serverManager: MCPServerManager) {
    this.systemServer = new SystemServer(serverManager);
  }

  /** Initialise (or re-initialise) the service with a given server manager. */
  public static initialize(serverManager: MCPServerManager): SystemServerService {
    if (instance) {
      // Shut down the previous instance if re-initialising
      instance.systemServer.shutdown().catch((err) => {
        console.error("[SystemServerService] Error shutting down previous instance:", err);
      });
    }
    instance = new SystemServerService(serverManager);
    return instance;
  }

  /** Get the current instance (throws if not initialised). */
  public static getInstance(): SystemServerService {
    if (!instance) {
      throw new Error("SystemServerService not initialised — call initialize() first");
    }
    return instance;
  }

  /** Reset the singleton (used during shutdown). */
  public static resetInstance(): void {
    instance = null;
  }

  /** Get the underlying SystemServer. */
  public getSystemServer(): SystemServer {
    return this.systemServer;
  }

  /** Shut down the system server. */
  public async shutdown(): Promise<void> {
    await this.systemServer.shutdown();
    instance = null;
  }
}

