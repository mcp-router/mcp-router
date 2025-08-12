/**
 * エラーハンドリングとログ出力のためのユーティリティ
 */

import { isDevelopment } from "./environment";

/**
 * INFO レベルのログを出力
 * @param args ログに出力する任意の引数
 */
export function logInfo(...args: any[]): void {
  if (isDevelopment()) {
    console.log("[INFO]", ...args);
  }
}

/**
 * ERROR レベルのログを出力
 * @param args ログに出力する任意の引数
 */
export function logError(...args: any[]): void {
  // エラーログは本番環境でも出力する
  console.error("[ERROR]", ...args);
}
