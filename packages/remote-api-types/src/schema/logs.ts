import { z } from "zod";
import type { RequestLogEntry } from "@mcp_router/shared";

// LogQueryOptions Zod schema
export const logQueryOptionsSchema = z.object({
  clientId: z.string().optional(),
  serverId: z.string().optional(),
  requestType: z.string().optional(),
  startDate: z.string().optional(), // ISO string
  endDate: z.string().optional(), // ISO string
  responseStatus: z.enum(["success", "error"]).optional(),
  cursor: z.string().optional(),
  limit: z.number().optional(),
});

export type LogQueryOptions = z.infer<typeof logQueryOptionsSchema>;

// tRPC Router type definition
export type LogsRouter = {
  list: {
    query: (input?: LogQueryOptions) => Promise<{
      logs: RequestLogEntry[];
      total: number;
      nextCursor?: string;
      hasMore: boolean;
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
