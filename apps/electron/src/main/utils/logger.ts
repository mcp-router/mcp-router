// apps/electron/src/main/utils/logger.ts
import { logger } from "./logger-factory";

/**
 * Wraps a logging function to safely handle EPIPE errors.
 * EPIPE occurs when writing to a closed pipe (e.g., when MCP server processes terminate).
 * These errors are non-critical and should be silently ignored.
 */
function safeLog<T extends (...args: unknown[]) => void>(fn: T): T {
  return ((...args: unknown[]) => {
    try {
      fn(...args);
    } catch (error: unknown) {
      // Silently ignore EPIPE errors - they occur when the receiving end of a pipe closes
      if (
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "EPIPE"
      ) {
        return;
      }
      // Re-throw other errors
      throw error;
    }
  }) as T;
}

/**
 * INFO level log
 */
export function logInfo(...args: unknown[]): void {
  if (args.length === 1) {
    logger.info(args[0]);
  } else {
    logger.info({ data: args }, String(args[0]));
  }
}

/**
 * ERROR level log
 */
export function logError(...args: unknown[]): void {
  if (args.length === 1 && args[0] instanceof Error) {
    logger.error({ err: args[0] }, args[0].message);
  } else if (args.length === 1) {
    logger.error(args[0]);
  } else {
    logger.error({ data: args }, String(args[0]));
  }
}

/**
 * WARN level log
 */
export function logWarn(...args: unknown[]): void {
  if (args.length === 1) {
    logger.warn(args[0]);
  } else {
    logger.warn({ data: args }, String(args[0]));
  }
}

/**
 * DEBUG level log
 */
export function logDebug(...args: unknown[]): void {
  if (args.length === 1) {
    logger.debug(args[0]);
  } else {
    logger.debug({ data: args }, String(args[0]));
  }
}

/**
 * Safe console.log wrapper that handles EPIPE errors gracefully.
 * Use this for logging in contexts where pipe errors may occur
 * (e.g., MCP server connection monitoring, transport callbacks).
 */
export const safeConsoleLog = safeLog(console.log.bind(console));

/**
 * Safe console.error wrapper that handles EPIPE errors gracefully.
 * Use this for error logging in contexts where pipe errors may occur.
 */
export const safeConsoleError = safeLog(console.error.bind(console));

/**
 * Safe console.warn wrapper that handles EPIPE errors gracefully.
 */
export const safeConsoleWarn = safeLog(console.warn.bind(console));

// Export logger for direct use
export { logger };
