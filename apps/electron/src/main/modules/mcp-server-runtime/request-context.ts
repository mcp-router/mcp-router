import { AsyncLocalStorage } from "node:async_hooks";

interface RequestContext {
  sessionId: string | null;
}

const requestContext = new AsyncLocalStorage<RequestContext>();

export function runWithSessionContext<T>(
  sessionId: string | null,
  fn: () => T,
): T {
  return requestContext.run({ sessionId }, fn);
}

export function getCurrentSessionId(): string | null {
  return requestContext.getStore()?.sessionId ?? null;
}
