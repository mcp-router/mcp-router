/**
 * エラーハンドリングとログ出力のためのユーティリティ
 */

import { app } from "electron";


/**
 * ログ出力のヘルパー関数
 * @param message ログメッセージ
 * @param data 追加データ（オブジェクト）
 * @param level ログレベル
 */
export function logInfo(message: string, data?: any): void {
  if (!app.isPackaged) {
    console.log(`[INFO] ${message}`, data || "");
  }
}

export function logError(message: string, error?: any): void {
  if (!app.isPackaged) {
    console.error(`[ERROR] ${message}`, error || "");
  }
}
