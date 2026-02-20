import { describe, it, expect, beforeEach } from "vitest";
import { getAuthRecoveryManager } from "../auth-recovery-manager";

describe("AuthRecoveryManager", () => {
  const manager = getAuthRecoveryManager();

  beforeEach(() => {
    manager.clear();
  });

  it("classifies auth errors and avoids 403 false positives", () => {
    expect(
      manager.classifyAuthError("401 Unauthorized token expired").isAuth,
    ).toBe(true);
    expect(manager.classifyAuthError("oauth consent required").reasonCode).toBe(
      "consent_required",
    );
    expect(manager.classifyAuthError("403 Forbidden by policy").isAuth).toBe(
      false,
    );
    expect(manager.classifyAuthError("socket timeout").isAuth).toBe(false);
  });

  it("stores only sanitized reason metadata", () => {
    const challenge = manager.registerAuthFailure({
      serverId: "srv_0",
      serverName: "workspace-mcp",
      reasonCode: "token_expired",
      reasonSummary: "Access token expired; re-authentication required.",
    });

    expect(challenge.reasonCode).toBe("token_expired");
    expect(challenge.reasonSummary).toContain("re-authentication");
    expect(Object.keys(challenge)).not.toContain("reason");
  });

  it("creates and updates challenge counters for same server", () => {
    const first = manager.registerAuthFailure({
      serverId: "srv_1",
      serverName: "workspace-mcp",
      toolName: "list_calendars",
      clientId: "claude-code",
      reasonCode: "authentication_required",
      reasonSummary: "Authentication is required before this tool can run.",
    });

    expect(first.failureCount).toBe(1);
    expect(first.state).toBe("action_required");

    const second = manager.registerAuthFailure({
      serverId: "srv_1",
      serverName: "workspace-mcp",
      toolName: "search_gmail_messages",
      clientId: "claude-code",
      reasonCode: "token_expired",
      reasonSummary: "Access token expired; re-authentication required.",
    });

    expect(second.id).toBe(first.id);
    expect(second.failureCount).toBe(2);
    expect(second.lastToolName).toBe("search_gmail_messages");
    expect(second.reasonCode).toBe("token_expired");
    expect(manager.getChallenges()).toHaveLength(1);
  });

  it("marks server recovered", () => {
    manager.registerAuthFailure({
      serverId: "srv_2",
      serverName: "notion",
      reasonCode: "invalid_token",
      reasonSummary: "Authentication token/credential is invalid.",
    });

    manager.markRecovered("srv_2");
    const [challenge] = manager.getChallenges("srv_2");
    expect(challenge.state).toBe("healthy");
  });
});
