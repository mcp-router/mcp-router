export const REINITIALIZE_REQUIRED_HEADER =
  "x-mcp-router-reinitialize-required";

export function createReinitializeRequiredJsonRpcError() {
  return {
    jsonrpc: "2.0" as const,
    error: {
      code: -32000,
      message: "Session not found or expired; reinitialize required",
    },
    id: null,
  };
}

export function shouldAutoRecoverInvalidStreamableSession(
  method: string,
  autoCreateSessionOnInvalidId: boolean,
): boolean {
  // Never create new sessions during delete/termination semantics.
  if (method.toUpperCase() === "DELETE") {
    return false;
  }
  if (!autoCreateSessionOnInvalidId) {
    return false;
  }
  return true;
}

/**
 * Non-initialize POST calls cannot bootstrap a fresh stateful session because
 * the MCP transport requires initialize first. Route these through the
 * stateless compatibility transport instead.
 */
export function shouldUseStatelessRecoveryTransport(
  method: string,
  payload?: unknown,
): boolean {
  return method.toUpperCase() === "POST" && !isInitializeRequest(payload);
}

function isJsonRpcRequest(
  payload: unknown,
): payload is { jsonrpc?: unknown; method?: unknown } {
  return !!payload && typeof payload === "object" && !Array.isArray(payload);
}

export function isInitializeRequest(payload: unknown): boolean {
  if (Array.isArray(payload)) {
    return payload.some((entry) => isInitializeRequest(entry));
  }
  if (!isJsonRpcRequest(payload)) {
    return false;
  }
  return payload.jsonrpc === "2.0" && payload.method === "initialize";
}
