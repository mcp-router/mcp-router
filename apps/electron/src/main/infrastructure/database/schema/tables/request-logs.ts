import { DatabaseTableSchema } from "@mcp_router/shared";

/**
 * リクエストログテーブルのスキーマ定義
 */
export const REQUEST_LOGS_SCHEMA: DatabaseTableSchema = {
  createSQL: `
    CREATE TABLE IF NOT EXISTS requestLogs (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      client_id TEXT NOT NULL,
      client_name TEXT NOT NULL,
      server_id TEXT NOT NULL,
      server_name TEXT NOT NULL,
      request_type TEXT NOT NULL,
      request_params TEXT,
      response_data TEXT,
      response_status TEXT NOT NULL,
      duration INTEGER NOT NULL,
      error_message TEXT
    )
  `,
  indexes: [
    "CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON requestLogs(timestamp)",
    "CREATE INDEX IF NOT EXISTS idx_request_logs_client_id ON requestLogs(client_id)",
    "CREATE INDEX IF NOT EXISTS idx_request_logs_server_id ON requestLogs(server_id)",
    "CREATE INDEX IF NOT EXISTS idx_request_logs_request_type ON requestLogs(request_type)",
    "CREATE INDEX IF NOT EXISTS idx_request_logs_response_status ON requestLogs(response_status)",
  ],
};

/**
 * 必須カラム定義
 */
export const REQUEST_LOGS_REQUIRED_COLUMNS = [
  "client_id",
  "client_name",
  "server_id",
  "server_name",
  "request_type",
  "response_status",
];
