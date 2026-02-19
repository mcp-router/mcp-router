import { describe, expect, it, vi } from "vitest";
import {
  collectServerIdsFromEventData,
  isApiEventAuthorized,
} from "../api-router";

describe("api-router event authorization", () => {
  it("collects server IDs from top-level and nested result records", () => {
    const ids = collectServerIdsFromEventData({
      serverId: "alpha",
      id: "beta",
      server: { id: "gamma" },
      result: [
        { serverId: "alpha" },
        { id: "delta" },
        { server: { id: "epsilon" } },
      ],
    });

    expect(ids.sort()).toEqual(["alpha", "beta", "delta", "epsilon", "gamma"]);
  });

  it("rejects events when token is missing", () => {
    const hasServerAccess = vi.fn().mockReturnValue(true);
    const allowed = isApiEventAuthorized(
      null,
      {
        type: "servers_updated",
        data: { serverId: "alpha" },
        timestamp: new Date().toISOString(),
      },
      hasServerAccess,
    );

    expect(allowed).toBe(false);
    expect(hasServerAccess).not.toHaveBeenCalled();
  });

  it("allows non-scoped events with any valid token", () => {
    const hasServerAccess = vi.fn().mockReturnValue(false);
    const allowed = isApiEventAuthorized(
      "token-1",
      {
        type: "heartbeat",
        data: {},
        timestamp: new Date().toISOString(),
      },
      hasServerAccess,
    );

    expect(allowed).toBe(true);
    expect(hasServerAccess).not.toHaveBeenCalled();
  });

  it("allows scoped config events without server IDs", () => {
    const hasServerAccess = vi.fn().mockReturnValue(false);
    const allowed = isApiEventAuthorized(
      "token-1",
      {
        type: "config_changed",
        data: { kind: "workspace" },
        timestamp: new Date().toISOString(),
      },
      hasServerAccess,
    );

    expect(allowed).toBe(true);
    expect(hasServerAccess).not.toHaveBeenCalled();
  });

  it("rejects scoped events when any referenced server is unauthorized", () => {
    const hasServerAccess = vi
      .fn()
      .mockImplementation(
        (_token: string, serverId: string) => serverId === "a",
      );
    const allowed = isApiEventAuthorized(
      "token-1",
      {
        type: "tool_list_changed",
        data: { result: [{ id: "a" }, { id: "b" }] },
        timestamp: new Date().toISOString(),
      },
      hasServerAccess,
    );

    expect(allowed).toBe(false);
    expect(hasServerAccess).toHaveBeenCalledTimes(2);
  });

  it("allows scoped events when all referenced servers are authorized", () => {
    const hasServerAccess = vi.fn().mockReturnValue(true);
    const allowed = isApiEventAuthorized(
      "token-1",
      {
        type: "servers_updated",
        data: { result: [{ serverId: "a" }, { server: { id: "b" } }] },
        timestamp: new Date().toISOString(),
      },
      hasServerAccess,
    );

    expect(allowed).toBe(true);
    expect(hasServerAccess).toHaveBeenCalledTimes(2);
  });
});
