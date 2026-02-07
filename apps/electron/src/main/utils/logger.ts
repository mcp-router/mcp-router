// apps/electron/src/main/utils/logger.ts
import { logger } from "./logger-factory";

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
function logWarn(...args: unknown[]): void {
  if (args.length === 1) {
    logger.warn(args[0]);
  } else {
    logger.warn({ data: args }, String(args[0]));
  }
}

/**
 * DEBUG level log
 */
function logDebug(...args: unknown[]): void {
  if (args.length === 1) {
    logger.debug(args[0]);
  } else {
    logger.debug({ data: args }, String(args[0]));
  }
}
