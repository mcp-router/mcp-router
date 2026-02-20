import { describe, it, expect, beforeEach } from "vitest";
import { getAuthRecoveryManager } from "../auth-recovery-manager";

describe("AuthRecoveryManager", () => {
  const manager = getAuthRecoveryManager();

  beforeEach(() => {
    manager.clear();
  });

  it("detects likely auth errors", () => {
    expect(manager.isLikelyAuthError("401 Unauthorized token expired")).toBe(
      true,
    );
    expect(manager.isLikelyAuthError("oauth consent required")).toBe(true);
    expect(manager.isLikelyAuthError("socket timeout")).toBe(false);
  });

  it("creates and updates challenge counters for same server", () => {
    const first = manager.registerAuthFailure({
      serverId: "srv_1",
      serverName: "workspace-mcp",
      toolName: "list_calendars",
      clientId: "claude-code",
      errorMessage: "Authentication required",
    });

    expect(first.failureCount).toBe(1);
    expect(first.state).toBe("action_required");

    const second = manager.registerAuthFailure({
      serverId: "srv_1",
      serverName: "workspace-mcp",
      toolName: "search_gmail_messages",
      clientId: "claude-code",
      errorMessage: "token expired",
    });

    expect(second.id).toBe(first.id);
    expect(second.failureCount).toBe(2);
    expect(second.lastToolName).toBe("search_gmail_messages");
    expect(manager.getChallenges()).toHaveLength(1);
  });

  it("marks server recovered", () => {
    manager.registerAuthFailure({
      serverId: "srv_2",
      serverName: "notion",
      errorMessage: "invalid token",
    });

    manager.markRecovered("srv_2");
    const [challenge] = manager.getChallenges("srv_2");
    expect(challenge.state).toBe("healthy");
  });
});
