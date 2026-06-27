/**
 * エラーハンドリングとログ出力のためのユーティリティ
 */

import { isDevelopment } from "./environment";

/**
 * Wraps a console method to safely handle EPIPE errors.
 * EPIPE occurs when stdout/stderr is closed (e.g., during app shutdown)
 * and the app tries to write to it.
 */
function safeConsoleWrapper<T extends (...args: any[]) => void>(
  originalMethod: T,
): T {
  return ((...args: any[]) => {
    try {
      originalMethod.apply(console, args);
    } catch (error: any) {
      // Silently ignore EPIPE errors - they occur when the output stream is closed
      if (error?.code !== "EPIPE") {
        // Re-throw non-EPIPE errors
        throw error;
      }
    }
  }) as T;
}

/**
 * Patches global console methods to handle EPIPE errors gracefully.
 * This prevents the app from crashing with infinite error dialogs
 * when stdout/stderr is closed during shutdown.
 *
 * Should be called as early as possible in the app lifecycle.
 */
export function patchConsoleForEpipe(): void {
  console.log = safeConsoleWrapper(console.log);
  console.error = safeConsoleWrapper(console.error);
  console.warn = safeConsoleWrapper(console.warn);
  console.info = safeConsoleWrapper(console.info);
  console.debug = safeConsoleWrapper(console.debug);
}

/**
 * INFO レベルのログを出力
 * @param args ログに出力する任意の引数
 */
export function logInfo(...args: any[]): void {
  if (isDevelopment()) {
    console.log("[INFO]", JSON.stringify(args));
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
