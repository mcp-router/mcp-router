import { describe, expect, it } from "vitest";
import { shouldAutoRecoverInvalidStreamableSession } from "../session-recovery-policy";

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
});
