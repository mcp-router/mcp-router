import { describe, expect, it } from "vitest";
import { shouldAutoRecoverInvalidStreamableSession } from "../session-recovery-policy";

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
});
