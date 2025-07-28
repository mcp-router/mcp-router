import { DatabaseTableSchema } from "@mcp_router/shared";
import {
  AGENTS_SCHEMA,
  AGENTS_REQUIRED_COLUMNS,
  DEPLOYED_AGENTS_SCHEMA,
  DEPLOYED_AGENTS_REQUIRED_COLUMNS,
  SERVERS_SCHEMA,
  SERVERS_REQUIRED_COLUMNS,
  REQUEST_LOGS_SCHEMA,
  REQUEST_LOGS_REQUIRED_COLUMNS,
  CHAT_SESSIONS_SCHEMA,
  CHAT_SESSIONS_REQUIRED_COLUMNS,
  SETTINGS_SCHEMA,
  MIGRATIONS_SCHEMA,
  WORKSPACES_SCHEMA,
} from "./tables";

/**
 * 統一されたデータベーススキーマ定義
 * すべてのテーブル定義を一箇所で管理
 */

/**
 * データベーススキーマ定義
 */
export const DATABASE_SCHEMA = {
  servers: SERVERS_SCHEMA,
  agents: AGENTS_SCHEMA,
  deployedAgents: DEPLOYED_AGENTS_SCHEMA,
  requestLogs: REQUEST_LOGS_SCHEMA,
  settings: SETTINGS_SCHEMA,
  chat_sessions: CHAT_SESSIONS_SCHEMA,
  migrations: MIGRATIONS_SCHEMA,
  workspaces: WORKSPACES_SCHEMA,
} as const;

/**
 * テーブル名の型定義
 */
export type TableName = keyof typeof DATABASE_SCHEMA;

/**
 * スキーマバージョン管理用の定数
 */
export const SCHEMA_VERSION = {
  // 各テーブルの最小必須カラム（これらがない場合は再作成が必要）
  REQUIRED_COLUMNS: {
    agents: AGENTS_REQUIRED_COLUMNS,
    deployedAgents: DEPLOYED_AGENTS_REQUIRED_COLUMNS,
    servers: SERVERS_REQUIRED_COLUMNS,
    chat_sessions: CHAT_SESSIONS_REQUIRED_COLUMNS,
    requestLogs: REQUEST_LOGS_REQUIRED_COLUMNS,
  },
} as const;
