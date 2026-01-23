import type { PlatformAPI } from "@mcp_router/shared";
import {
  createRemoteAPIClient,
  type RemoteAPIClient,
} from "@mcp_router/remote-api-types";
import { MCPServer, MCPServerConfig, MCPTool } from "@mcp_router/shared";
import type {
  ServerStatus,
  CreateServerInput,
  LogQueryOptions,
  LogQueryResult,
} from "@mcp_router/shared";
import type { RequestLogEntry } from "@mcp_router/shared";

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
  private localPlatformAPI: PlatformAPI;

  constructor(config: RemoteWorkspaceConfig, localPlatformAPI: PlatformAPI) {
    this.config = config;
    this.localPlatformAPI = localPlatformAPI;
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
    listTools: async (id: string): Promise<MCPTool[]> => {
      throw new Error(
        "Tool management is not yet supported for remote workspaces.",
      );
    },

    get: async (id: string): Promise<MCPServer | null> => {
      const response = await this.client.servers.get.query({ id });
      return this.unwrapResponse<MCPServer | null>(response);
    },

    create: async (input: CreateServerInput): Promise<MCPServer> => {
      const convertedInput = {
        ...input,
        dxtFile: input.dxtFile ? new Uint8Array(input.dxtFile) : undefined,
      };
      const response = await this.client.servers.create.mutate(convertedInput);
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
    updateToolPermissions: async (
      _id: string,
      _permissions: Record<string, boolean>,
    ): Promise<MCPServer> => {
      throw new Error(
        "Tool management is not yet supported for remote workspaces.",
      );
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

    selectFile: (options?: {
      title?: string;
      mode?: "file" | "directory";
      filters?: { name: string; extensions: string[] }[];
    }) => {
      // File selection is a local operation
      return this.localPlatformAPI.servers.selectFile(options);
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

      // Convert to RequestLogEntry format
      const logs: RequestLogEntry[] = result.logs.map((log) => ({
        id: log.id,
        timestamp: log.timestamp, // Keep as number, not Date
        clientId: log.clientId,
        clientName: log.clientName,
        serverId: log.serverId,
        serverName: log.serverName,
        requestType: log.requestType,
        requestParams: log.requestParams,
        responseStatus: log.responseStatus,
        responseData: log.responseData,
        duration: log.duration,
        errorMessage: log.errorMessage,
      }));

      return {
        items: logs, // LogQueryResult extends CursorPaginationResult which requires items
        logs, // Keep for backward compatibility
        total: result.total,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore ?? false,
      };
    },
  };

  // All other APIs delegate to local implementation
  get apps() {
    return this.localPlatformAPI.apps;
  }

  get auth() {
    return this.localPlatformAPI.auth;
  }

  get packages() {
    return this.localPlatformAPI.packages;
  }

  get settings() {
    return this.localPlatformAPI.settings;
  }

  get cloudSync() {
    return this.localPlatformAPI.cloudSync;
  }

  get workspaces() {
    return this.localPlatformAPI.workspaces;
  }

  get workflows() {
    return this.localPlatformAPI.workflows;
  }

  get projects() {
    return this.localPlatformAPI.projects;
  }

  get skills() {
    return this.localPlatformAPI.skills;
  }
}
