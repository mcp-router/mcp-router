import { SingletonService } from "@/main/modules/singleton-service";
import { MCPServer, MCPServerConfig } from "@mcp_router/shared";
import { logInfo } from "@/main/utils/logger";
import { McpServerManagerRepository } from "./mcp-server-manager.repository";

/**
 * Service class for managing server information
 */
export class ServerService extends SingletonService<
  MCPServer,
  string,
  ServerService
> {
  /**
   * Constructor
   */
  protected constructor() {
    super();
  }

  /**
   * Get entity name
   */
  protected getEntityName(): string {
    return "Server";
  }

  /**
   * Get singleton instance of ServerService
   */
  public static getInstance(): ServerService {
    return (this as any).getInstanceBase();
  }

  /**
   * Reset instance (used when switching workspaces)
   */
  public static resetInstance(): void {
    this.resetInstanceBase(ServerService);
  }

  /**
   * Add server info
   * @param serverConfig Server configuration
   * @returns The added server info
   */
  public addServer(serverConfig: MCPServerConfig): MCPServer {
    try {
      return McpServerManagerRepository.getInstance().addServer(serverConfig);
    } catch (error) {
      return this.handleError("add", error);
    }
  }

  /**
   * Get all server info
   * @returns Array of server info
   */
  public getAllServers(): MCPServer[] {
    try {
      return McpServerManagerRepository.getInstance().getAllServers();
    } catch (error) {
      return this.handleError("retrieval", error, []);
    }
  }

  /**
   * Get server info by ID
   * @param id Server ID
   * @returns Server info (undefined if not found)
   */
  public getServerById(id: string): MCPServer | undefined {
    try {
      return McpServerManagerRepository.getInstance().getServerById(id);
    } catch (error) {
      return this.handleError(`retrieval of ID:${id}`, error, undefined);
    }
  }

  /**
   * Update server info
   * @param id Server ID
   * @param config Server configuration to update
   * @returns Updated server info (undefined if not found)
   */
  public updateServer(
    id: string,
    config: Partial<MCPServerConfig>,
  ): MCPServer | undefined {
    try {
      const result = McpServerManagerRepository.getInstance().updateServer(
        id,
        config,
      );
      if (result) {
        try {
          logInfo(`Server "${result.name}" updated (ID: ${id})`);
        } catch (logError) {
          // Logger worker may have exited - ignore logging errors
          console.log(`Server "${result.name}" updated (ID: ${id})`);
        }
      }
      return result;
    } catch (error) {
      return this.handleError(`update of ID:${id}`, error, undefined);
    }
  }

  /**
   * Delete server info
   * @param id Server ID
   * @returns true if deletion succeeded, false otherwise
   */
  public deleteServer(id: string): boolean {
    try {
      const server = this.getServerById(id);
      const result = McpServerManagerRepository.getInstance().deleteServer(id);

      if (result && server) {
        try {
          logInfo(`Server "${server.name}" deleted (ID: ${id})`);
        } catch (logError) {
          // Logger worker may have exited - ignore logging errors
          console.log(`Server "${server.name}" deleted (ID: ${id})`);
        }
      }

      return result;
    } catch (error) {
      return this.handleError(`deletion of ID:${id}`, error, false);
    }
  }
}

/**
 * Get the ServerService singleton instance
 */
export function getServerService(): ServerService {
  return ServerService.getInstance();
}
