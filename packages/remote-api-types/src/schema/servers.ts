import { z } from "zod";
import { MCPServer } from "@mcp_router/shared";

// MCPServerConfig Zodスキーマ
export const mcpServerConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  env: z.record(z.string()),
  setupInstructions: z.string().optional(),
  autoStart: z.boolean().optional(),
  disabled: z.boolean().optional(),
  description: z.string().optional(),
  serverType: z.enum(["local", "remote", "remote-streamable"]),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  remoteUrl: z.string().optional(),
  bearerToken: z.string().optional(),
  inputParams: z
    .record(
      z.object({
        type: z
          .enum(["string", "number", "boolean", "directory", "file"])
          .optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        sensitive: z.boolean().optional(),
        required: z.boolean().optional(),
        default: z.union([z.string(), z.number(), z.boolean()]).optional(),
        min: z.number().optional(),
        max: z.number().optional(),
      }),
    )
    .optional(),
  required: z.array(z.string()).optional(),
  latestVersion: z.string().optional(),
  verificationStatus: z.enum(["verified", "unverified"]).optional(),
  version: z.string().optional(),
  toolPermissions: z.record(z.string(), z.boolean()).optional(),
});

// CreateServerInput Zodスキーマ
export const createServerSchema = z.object({
  type: z.enum(["config", "dxt"]),
  config: mcpServerConfigSchema.optional(),
  dxtFile: z.instanceof(Uint8Array).optional(),
});

// UpdateServerInput Zodスキーマ
export const updateServerSchema = z.object({
  id: z.string(),
  config: mcpServerConfigSchema.partial(),
});

// 削除用スキーマ
export const deleteServerSchema = z.object({
  id: z.string(),
});

// 型定義
export interface ServerStatus {
  type: "stopped" | "starting" | "running" | "stopping" | "error";
  error?: string;
  connectedAt?: Date;
  stats?: {
    requests: number;
    errors: number;
    uptime: number;
  };
}

// Serverインターフェースを削除し、MCPServerを直接使用
export type CreateServerInput = z.infer<typeof createServerSchema>;
export type UpdateServerInput = z.infer<typeof updateServerSchema>;

// tRPC Router型定義
export type ServersRouter = {
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
