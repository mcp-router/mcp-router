export function shouldAutoRecoverInvalidStreamableSession(
  method: string,
  autoCreateSessionOnInvalidId: boolean,
  payload?: unknown,
): boolean {
  // Never create new sessions during delete/termination semantics.
  if (method.toUpperCase() === "DELETE") {
    return false;
  }
  if (!autoCreateSessionOnInvalidId) {
    return false;
  }

  // POST requests must be initialize requests to safely recover into
  // a brand-new streamable session. Otherwise the server is uninitialized.
  if (method.toUpperCase() === "POST") {
    return isInitializeRequest(payload);
  }

  return true;
}

function isJsonRpcRequest(payload: unknown): payload is { method?: unknown } {
  return !!payload && typeof payload === "object" && !Array.isArray(payload);
}

export function isInitializeRequest(payload: unknown): boolean {
  if (Array.isArray(payload)) {
    return payload.some((entry) => isInitializeRequest(entry));
  }
  if (!isJsonRpcRequest(payload)) {
    return false;
  }
  return payload.method === "initialize";
}
