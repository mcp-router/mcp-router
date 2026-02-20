import { describe, expect, it } from "vitest";
import {
  createReinitializeRequiredJsonRpcError,
  REINITIALIZE_REQUIRED_HEADER,
  shouldAutoRecoverInvalidStreamableSession,
} from "../session-recovery-policy";

describe("streamable session recovery policy", () => {
  it("recovers stale sessions for POST in compatibility mode", () => {
    expect(
      shouldAutoRecoverInvalidStreamableSession("POST", true, {
        jsonrpc: "2.0",
        method: "initialize",
        id: 1,
      }),
    ).toBe(true);
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

  it("does not recover stale POST sessions for non-initialize calls", () => {
    expect(
      shouldAutoRecoverInvalidStreamableSession("POST", true, {
        jsonrpc: "2.0",
        method: "tools/list",
        id: 1,
      }),
    ).toBe(false);
  });

  it("does not recover stale POST sessions for malformed initialize payloads", () => {
    expect(
      shouldAutoRecoverInvalidStreamableSession("POST", true, {
        method: "initialize",
        id: 1,
      }),
    ).toBe(false);

    expect(
      shouldAutoRecoverInvalidStreamableSession("POST", true, {
        jsonrpc: "1.0",
        method: "initialize",
        id: 1,
      }),
    ).toBe(false);
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
