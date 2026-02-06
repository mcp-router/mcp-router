import {
  createTRPCProxyClient,
  httpBatchLink,
  TRPCClientError,
} from "@trpc/client";
import superjson from "superjson";
import { MCPServer } from "@mcp_router/shared";
import type {
  ServerStatus,
  CreateServerInput,
  UpdateServerInput,
  RequestLogEntry,
  LogQueryOptions,
} from "./schema";

export interface RemoteAPIClientConfig {
  url: string;
  token: string;
  headers?: Record<string, string>;
}

/**
 * Create a tRPC client
 *
 * Note: The server side must implement a tRPC router that conforms to the RemoteAPIRouter interface.
 */
export function createRemoteAPIClient(
  config: RemoteAPIClientConfig,
): RemoteAPIClient {
  const client = createTRPCProxyClient<any>({
    links: [
      httpBatchLink({
        url: `${config.url}/trpc`,
        transformer: superjson,
        headers: () => ({
          authorization: `Bearer ${config.token}`,
          ...config.headers,
        }),
        // 30-second timeout
        fetch: (url, options) => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 30000);

          return fetch(url, {
            ...options,
            signal: controller.signal,
          }).finally(() => clearTimeout(timeout));
        },
      }),
    ],
  });

  return client as unknown as RemoteAPIClient;
}

// Type-safe client interface
export interface RemoteAPIClient {
  servers: {
    list: {
      query: () => Promise<MCPServer[]>;
    };
    get: {
      query: (input: { id: string }) => Promise<MCPServer | null>;
    };
    create: {
      mutate: (input: CreateServerInput) => Promise<MCPServer>;
    };
    update: {
      mutate: (input: UpdateServerInput) => Promise<MCPServer>;
    };
    delete: {
      mutate: (input: { id: string }) => Promise<void>;
    };
    start: {
      mutate: (input: { id: string }) => Promise<void>;
    };
    stop: {
      mutate: (input: { id: string }) => Promise<void>;
    };
    getStatus: {
      query: (input: { id: string }) => Promise<ServerStatus>;
    };
  };
  logs: {
    list: {
      query: (input?: LogQueryOptions) => Promise<{
        logs: RequestLogEntry[];
        total: number;
      }>;
    };
    get: {
      query: (input: { id: string }) => Promise<RequestLogEntry | null>;
    };
    delete: {
      mutate: (input: { id: string }) => Promise<void>;
    };
    clear: {
      mutate: (input?: { serverId?: string }) => Promise<void>;
    };
  };
}

export { TRPCClientError };
