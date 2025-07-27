import type { ServersRouter } from "./servers";
import type { LogsRouter } from "./logs";

// メインのRouter型定義
export type RemoteAPIRouter = {
  servers: ServersRouter;
  logs: LogsRouter;
};

// 各ドメインのRouter型をエクスポート
export type { ServersRouter } from "./servers";
export type { LogsRouter } from "./logs";

// Zodスキーマのエクスポート（サーバー側で使用）
export {
  mcpServerConfigSchema,
  createServerSchema,
  updateServerSchema,
  deleteServerSchema,
} from "./servers";

export { logQueryOptionsSchema } from "./logs";

// 型のエクスポート
export type {
  ServerStatus,
  CreateServerInput,
  UpdateServerInput,
} from "./servers";

export type { LogQueryOptions } from "./logs";
export type { RequestLogEntry, MCPServer } from "@mcp_router/shared";
