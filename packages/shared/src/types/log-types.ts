/**
 * リクエストログ関連の型定義
 */

import { CursorPaginationOptions, CursorPaginationResult } from "./pagination";

/**
 * リクエストログエントリのインターフェース
 */
export interface RequestLogEntry {
  id: string; // 一意のID
  timestamp: number; // UNIX タイムスタンプ
  clientId: string; // クライアント識別子
  clientName: string; // クライアント名
  serverId: string; // サーバ識別子
  serverName: string; // サーバ名
  requestType: string; // リクエストタイプ（CallTool, ReadResource など）
  requestParams: any; // リクエストパラメータ
  responseStatus: "success" | "error"; // レスポンスステータス
  responseData?: any; // レスポンスデータ
  duration: number; // 処理時間（ms）
  errorMessage?: string; // エラーメッセージ（あれば）
}

/**
 * リクエストログ新規作成時の入力インターフェース（idとtimestampは自動生成）
 */
export type RequestLogEntryInput = Omit<RequestLogEntry, "id" | "timestamp">;

/**
 * リクエストログクエリのフィルターオプション
 */
export interface RequestLogFilters {
  clientId?: string;
  serverId?: string;
  requestType?: string;
  startDate?: Date;
  endDate?: Date;
  responseStatus?: "success" | "error";
}

/**
 * リクエストログクエリのオプション
 */
export interface RequestLogQueryOptions
  extends RequestLogFilters, CursorPaginationOptions {}

/**
 * リクエストログクエリの結果
 */
export interface RequestLogQueryResult extends CursorPaginationResult<RequestLogEntry> {
  logs: RequestLogEntry[]; // 互換性のため残す
}

/**
 * MCP Manager用のシンプルなリクエストログエントリ
 */
export interface McpManagerRequestLogEntry {
  timestamp: string;
  requestType: string;
  params: any;
  result: "success" | "error";
  errorMessage?: string;
  response?: any;
  duration: number;
  clientId: string;
}

/**
 * MCP Aggregatorサーバーの定数
 */
export const AGGREGATOR_SERVER_ID = "mcp-router-aggregator";
export const AGGREGATOR_SERVER_NAME = "MCP Router Aggregator";
