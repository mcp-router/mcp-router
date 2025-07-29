export interface RequestLogEntry {
  timestamp: string;
  requestType: string;
  params: any;
  result: "success" | "error";
  errorMessage?: string;
  response?: any;
  duration: number;
  clientId: string;
}

export const AGGREGATOR_SERVER_ID = "mcp-router-aggregator";
export const AGGREGATOR_SERVER_NAME = "MCP Router Aggregator";
