/**
 * エラーハンドリングとログ出力のためのユーティリティ
 */

import { isDevelopment } from "./environment";

/**
 * ログ出力のヘルパー関数
 * @param message ログメッセージ
 * @param data 追加データ（オブジェクト）
 * @param level ログレベル
 */
export function logInfo(message: string, data?: any): void {
  if (isDevelopment()) {
    console.log(`[INFO] ${message}`, data || "");
  }
}

export function logError(message: string, error?: any): void {
  if (isDevelopment()) {
    console.error(`[ERROR] ${message}`, error || "");
  }
}
