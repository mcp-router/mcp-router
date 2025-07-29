/**
 * ログエントリの型変換ユーティリティ
 */

import { RequestLogEntry, PlatformLogEntry } from "@mcp_router/shared";

/**
 * LogEntryをRequestLogEntryに変換
 */
function convertLogEntryToRequestLogEntry(
  log: PlatformLogEntry,
): RequestLogEntry {
  return {
    id: log.id,
    timestamp:
      log.timestamp instanceof Date
        ? log.timestamp.getTime()
        : (log.timestamp as any),
    clientId: log.clientId,
    clientName: log.details?.clientName || "unknown",
    serverId: log.serverId,
    serverName: log.details?.serverName || "unknown",
    requestType: log.requestType,
    requestParams: log.details?.requestParams,
    responseStatus: log.responseStatus,
    responseData: log.details?.responseData,
    duration: log.duration || 0,
    errorMessage: log.error,
  };
}

/**
 * ログエントリが既にRequestLogEntry形式かどうかを判定
 */
function isRequestLogEntry(log: any): log is RequestLogEntry {
  return (
    typeof log === "object" &&
    "clientName" in log &&
    "serverName" in log &&
    typeof log.timestamp === "number"
  );
}

/**
 * 任意のログエントリをRequestLogEntry形式に正規化
 */
export function normalizeToRequestLogEntry(log: any): RequestLogEntry {
  if (isRequestLogEntry(log)) {
    return log;
  }
  return convertLogEntryToRequestLogEntry(log as PlatformLogEntry);
}
