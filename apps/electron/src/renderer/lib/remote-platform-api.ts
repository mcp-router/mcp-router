import type { PlatformAPI } from "@/main/infrastructure/platform-api/types/platform-api";
import {
  createRemoteAPIClient,
  type RemoteAPIClient,
} from "@mcp_router/remote-api-types";
import { MCPServer, MCPServerConfig } from "@mcp_router/shared";
import type {
  ServerStatus,
  CreateServerInput,
} from "@/main/infrastructure/platform-api/types/domains/server-api";
import type {
  LogQueryOptions,
  LogEntry,
  LogQueryResult,
} from "@/main/infrastructure/platform-api/types/domains/log-api";

interface RemoteWorkspaceConfig {
  apiUrl: string;
  userToken: string;
}

/**
 * Remote Platform API implementation that communicates with a remote API server using tRPC
 * Only servers and logs are handled remotely, all other operations are delegated to local Electron API
 */
export class RemotePlatformAPI implements PlatformAPI {
  private client!: RemoteAPIClient; // Using definite assignment assertion since it's initialized in constructor
  private config: RemoteWorkspaceConfig;

  constructor(config: RemoteWorkspaceConfig) {
    this.config = config;
    // Client will be initialized with user token when needed
    this.initializeClient();
  }

  private initializeClient(): void {
    if (!this.config.userToken) {
      throw new Error(
        "User authentication token is required for remote workspaces",
      );
    }

    this.client = createRemoteAPIClient({
      url: this.config.apiUrl.replace(/\/$/, ""), // Remove trailing slash
      token: this.config.userToken,
    });
  }

  /**
   * Unwrap nested response structure from tRPC
   * The response might be wrapped in { result: { data: { json: ... } } }
   */
  private unwrapResponse<T>(response: any): T {
    // Direct response
    if (response && (typeof response !== "object" || Array.isArray(response))) {
      return response as T;
    }

    // Check for nested structures
    if (response?.result?.data?.json !== undefined) {
      return response.result.data.json as T;
    }

    if (response?.data?.json !== undefined) {
      return response.data.json as T;
    }

    if (response?.json !== undefined) {
      return response.json as T;
    }

    // If the response has expected properties directly, return it
    // This handles cases where the response is already unwrapped
    return response as T;
  }

  // Server API implementation - All operations remote via tRPC
  readonly servers = {
    list: async (): Promise<MCPServer[]> => {
      const response = await this.client.servers.list.query();
      const servers = this.unwrapResponse<MCPServer[]>(response);
      return servers;
    },

    get: async (id: string): Promise<MCPServer | null> => {
      const response = await this.client.servers.get.query({ id });
      return this.unwrapResponse<MCPServer | null>(response);
    },

    create: async (input: CreateServerInput): Promise<MCPServer> => {
      const response = await this.client.servers.create.mutate(input);
      return this.unwrapResponse<MCPServer>(response);
    },

    update: async (
      id: string,
      updates: Partial<MCPServerConfig>,
    ): Promise<MCPServer> => {
      const response = await this.client.servers.update.mutate({
        id,
        config: updates,
      });
      return this.unwrapResponse<MCPServer>(response);
    },

    delete: async (id: string): Promise<void> => {
      await this.client.servers.delete.mutate({ id });
    },

    // Server execution operations - Remote only
    start: async (id: string): Promise<boolean> => {
      await this.client.servers.start.mutate({ id });
      return true;
    },

    stop: async (id: string): Promise<boolean> => {
      await this.client.servers.stop.mutate({ id });
      return true;
    },

    getStatus: async (id: string): Promise<ServerStatus> => {
      const response = await this.client.servers.getStatus.query({ id });
      return this.unwrapResponse<ServerStatus>(response);
    },

    fetchFromIndex: async (
      _page?: number,
      _limit?: number,
      _search?: string,
      _isVerified?: boolean,
    ) => {
      // This operation is specific to the MCP index and might not be available remotely
      throw new Error("fetchFromIndex is not supported in remote workspaces");
    },

    fetchVersionDetails: async (_displayId: string, _version: string) => {
      // This operation is specific to the MCP index and might not be available remotely
      throw new Error(
        "fetchVersionDetails is not supported in remote workspaces",
      );
    },
  };

  // Log API implementation via tRPC
  logs = {
    query: async (options?: LogQueryOptions): Promise<LogQueryResult> => {
      const response = await this.client.logs.list.query({
        clientId: options?.clientId,
        serverId: options?.serverId,
        requestType: options?.requestType,
        responseStatus: options?.responseStatus,
        limit: options?.limit,
        cursor: options?.cursor,
        startDate: options?.startDate?.toISOString(),
        endDate: options?.endDate?.toISOString(),
      });

      const result = this.unwrapResponse<{
        logs: any[];
        total: number;
        nextCursor?: string;
        hasMore?: boolean;
      }>(response);

      // Convert RequestLogEntry to LogEntry format
      const logs: LogEntry[] = result.logs.map((log) => ({
        id: log.id,
        timestamp: new Date(log.timestamp),
        clientId: log.clientId,
        serverId: log.serverId,
        requestType: log.requestType,
        responseStatus: log.responseStatus,
        duration: log.duration,
        error: log.errorMessage,
        details: {
          clientName: log.clientName,
          serverName: log.serverName,
          requestParams: log.requestParams,
          responseData: log.responseData,
        },
      }));

      return {
        items: logs, // CursorPaginationResult requires items property
        logs, // Keep for backward compatibility
        total: result.total,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore ?? false,
      };
    },
  };

  // All other APIs delegate to local implementation
  get agents() {
    return electronPlatformAPI.agents;
  }

  get apps() {
    return electronPlatformAPI.apps;
  }

  get auth() {
    return electronPlatformAPI.auth;
  }

  get packages() {
    return electronPlatformAPI.packages;
  }

  get settings() {
    return electronPlatformAPI.settings;
  }

  get workspaces() {
    return electronPlatformAPI.workspaces;
  }
}

// Import at the end to avoid circular dependency
import { electronPlatformAPI } from "./electron-platform-api";
