/**
 * Safe console wrappers that suppress EPIPE errors.
 *
 * Keep this module free of logger-factory/pino imports so it can be used in
 * environments where file-backed logging is unavailable (e.g. restricted tests).
 */
function safeLog<T extends (...args: unknown[]) => void>(fn: T): T {
  return ((...args: unknown[]) => {
    try {
      fn(...args);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "EPIPE"
      ) {
        return;
      }
      throw error;
    }
  }) as T;
}

export const safeConsoleLog = safeLog(console.log.bind(console));
export const safeConsoleError = safeLog(console.error.bind(console));
