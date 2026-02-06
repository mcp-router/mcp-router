import type { ServersRouter } from "./servers";
import type { LogsRouter } from "./logs";

// Main Router type definition
export type RemoteAPIRouter = {
  servers: ServersRouter;
  logs: LogsRouter;
};

// Export Router types for each domain
export type { ServersRouter } from "./servers";
export type { LogsRouter } from "./logs";

// Export Zod schemas (used on the server side)
export {
  mcpServerConfigSchema,
  createServerSchema,
  updateServerSchema,
  deleteServerSchema,
} from "./servers";

export { logQueryOptionsSchema } from "./logs";

// Export types
export type {
  ServerStatus,
  CreateServerInput,
  UpdateServerInput,
} from "./servers";

export type { LogQueryOptions } from "./logs";
export type { RequestLogEntry, MCPServer } from "@mcp_router/shared";
