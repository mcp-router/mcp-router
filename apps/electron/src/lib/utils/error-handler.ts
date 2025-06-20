/**
 * エラーハンドリングとログ出力のためのユーティリティ
 */

import { app } from "electron";

/**
 * データベース操作中の例外を処理する
 * @param operation 実行中の操作の説明
 * @param error 発生したエラー
 * @param defaultReturnValue エラー時に返す値（ある場合）
 */
export function handleDatabaseError(
  operation: string,
  error: any,
  defaultReturnValue?: any,
): never | any {
  console.error(`[Database Error] ${operation}:`, error);

  // スタックトレースがある場合はログに記録
  if (error.stack) {
    console.error(`[Database Error] スタックトレース:`, error.stack);
  }

  // デフォルト値が指定されている場合は返す
  if (arguments.length >= 3) {
    console.warn(`[Database Recovery] ${operation}: デフォルト値を返します`);
    return defaultReturnValue;
  }

  // デフォルト値がない場合は例外を再スロー
  throw error;
}

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
