import { describe, expect, it } from "vitest";
import {
  createReinitializeRequiredJsonRpcError,
  REINITIALIZE_REQUIRED_HEADER,
  shouldAutoRecoverInvalidStreamableSession,
  shouldUseStatelessRecoveryTransport,
} from "../session-recovery-policy";

describe("streamable session recovery policy", () => {
  it("recovers stale sessions for POST in compatibility mode", () => {
    expect(shouldAutoRecoverInvalidStreamableSession("POST", true)).toBe(true);
  });

  it("recovers stale sessions for GET in compatibility mode", () => {
    expect(shouldAutoRecoverInvalidStreamableSession("GET", true)).toBe(true);
  });

  it("never recovers stale sessions for DELETE", () => {
    expect(shouldAutoRecoverInvalidStreamableSession("DELETE", true)).toBe(
      false,
    );
  });

  it("does not recover when strict mode is enabled", () => {
    expect(shouldAutoRecoverInvalidStreamableSession("POST", false)).toBe(
      false,
    );
  });

  it("routes stale non-initialize POST calls through stateless compatibility transport", () => {
    expect(
      shouldUseStatelessRecoveryTransport("POST", {
        jsonrpc: "2.0",
        method: "tools/list",
        id: 1,
      }),
    ).toBe(true);
  });

  it("does not use stateless compatibility transport for initialize payloads", () => {
    expect(
      shouldUseStatelessRecoveryTransport("POST", {
        jsonrpc: "2.0",
        method: "initialize",
        id: 1,
      }),
    ).toBe(false);
  });

  it("uses stateless compatibility transport for malformed initialize payloads", () => {
    expect(
      shouldUseStatelessRecoveryTransport("POST", {
        method: "initialize",
        id: 1,
      }),
    ).toBe(true);

    expect(
      shouldUseStatelessRecoveryTransport("POST", {
        jsonrpc: "1.0",
        method: "initialize",
        id: 1,
      }),
    ).toBe(true);
  });

  it("defines a stable reinitialize-required response contract", () => {
    expect(REINITIALIZE_REQUIRED_HEADER).toBe(
      "x-mcp-router-reinitialize-required",
    );
    expect(createReinitializeRequiredJsonRpcError()).toEqual({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Session not found or expired; reinitialize required",
      },
      id: null,
    });
  });
});
