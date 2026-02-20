import { getEventBridge } from "./event-bridge";

export type AuthRecoveryState =
  | "healthy"
  | "refreshing"
  | "action_required"
  | "failed";

export interface AuthChallenge {
  id: string;
  serverId: string;
  serverName: string;
  state: AuthRecoveryState;
  reasonCode: string;
  reasonSummary: string;
  firstSeenAt: string;
  lastSeenAt: string;
  failureCount: number;
  lastToolName?: string;
  lastClientId?: string;
}

interface RegisterAuthFailureInput {
  serverId: string;
  serverName: string;
  toolName?: string;
  clientId?: string;
  reasonCode: string;
  reasonSummary: string;
}

export interface AuthClassification {
  isAuth: boolean;
  reasonCode: string;
  reasonSummary: string;
}

class AuthRecoveryManager {
  private challenges = new Map<string, AuthChallenge>();

  classifyAuthError(errorMessage: string): AuthClassification {
    const message = errorMessage.toLowerCase();

    // Explicit token lifecycle/auth flow signatures
    if (/token\s*expired/.test(message)) {
      return {
        isAuth: true,
        reasonCode: "token_expired",
        reasonSummary: "Access token expired; re-authentication required.",
      };
    }
    if (/invalid[_\s-]?grant/.test(message)) {
      return {
        isAuth: true,
        reasonCode: "invalid_grant",
        reasonSummary:
          "Refresh/authorization grant is invalid; user re-authentication required.",
      };
    }
    if (/invalid\s*(token|credential)/.test(message)) {
      return {
        isAuth: true,
        reasonCode: "invalid_token",
        reasonSummary: "Authentication token/credential is invalid.",
      };
    }
    if (/token\s*revoked/.test(message)) {
      return {
        isAuth: true,
        reasonCode: "token_revoked",
        reasonSummary: "Authentication token was revoked.",
      };
    }
    if (/consent\s*required/.test(message)) {
      return {
        isAuth: true,
        reasonCode: "consent_required",
        reasonSummary: "Provider requires renewed consent in browser.",
      };
    }
    if (/needs\s*authentication|authentication\s*required/.test(message)) {
      return {
        isAuth: true,
        reasonCode: "authentication_required",
        reasonSummary: "Authentication is required before this tool can run.",
      };
    }
    if (/oauth/.test(message)) {
      return {
        isAuth: true,
        reasonCode: "oauth_error",
        reasonSummary: "OAuth authentication flow is required or failed.",
      };
    }

    // Narrow 401/unauthorized detection to auth-context signals only.
    if (
      (/\b401\b/.test(message) || /unauthorized/.test(message)) &&
      /(token|credential|auth|oauth|expired|refresh)/.test(message)
    ) {
      return {
        isAuth: true,
        reasonCode: "unauthorized_auth",
        reasonSummary: "Authentication failed with unauthorized response.",
      };
    }

    // Do NOT treat generic forbidden/403 as auth-expired by default.
    if (/\b403\b/.test(message) || /forbidden/.test(message)) {
      return {
        isAuth: false,
        reasonCode: "forbidden_or_policy",
        reasonSummary:
          "Request forbidden by policy/authorization; re-auth may not help.",
      };
    }

    return {
      isAuth: false,
      reasonCode: "not_auth_related",
      reasonSummary: "Failure does not match known auth-expiry signatures.",
    };
  }

  registerAuthFailure(input: RegisterAuthFailureInput): AuthChallenge {
    const key = `${input.serverId}`;
    const now = new Date().toISOString();

    const existing = this.challenges.get(key);
    if (existing) {
      const updated: AuthChallenge = {
        ...existing,
        state: "action_required",
        lastSeenAt: now,
        failureCount: existing.failureCount + 1,
        reasonCode: input.reasonCode,
        reasonSummary: input.reasonSummary,
        lastToolName: input.toolName,
        lastClientId: input.clientId,
      };
      this.challenges.set(key, updated);
      getEventBridge().emit("auth_challenge", {
        challengeId: updated.id,
        serverId: updated.serverId,
        serverName: updated.serverName,
        state: updated.state,
        failureCount: updated.failureCount,
      });
      return updated;
    }

    const created: AuthChallenge = {
      id: `auth_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      serverId: input.serverId,
      serverName: input.serverName,
      state: "action_required",
      reasonCode: input.reasonCode,
      reasonSummary: input.reasonSummary,
      firstSeenAt: now,
      lastSeenAt: now,
      failureCount: 1,
      lastToolName: input.toolName,
      lastClientId: input.clientId,
    };

    this.challenges.set(key, created);
    getEventBridge().emit("auth_challenge", {
      challengeId: created.id,
      serverId: created.serverId,
      serverName: created.serverName,
      state: created.state,
      failureCount: created.failureCount,
    });
    return created;
  }

  markRecovered(serverId: string): void {
    const challenge = this.challenges.get(serverId);
    if (!challenge) return;

    const recovered: AuthChallenge = {
      ...challenge,
      state: "healthy",
      lastSeenAt: new Date().toISOString(),
    };
    this.challenges.set(serverId, recovered);

    getEventBridge().emit("auth_challenge", {
      challengeId: recovered.id,
      serverId: recovered.serverId,
      serverName: recovered.serverName,
      state: recovered.state,
      failureCount: recovered.failureCount,
    });
  }

  getChallenges(serverId?: string): AuthChallenge[] {
    if (serverId) {
      const one = this.challenges.get(serverId);
      return one ? [one] : [];
    }

    return Array.from(this.challenges.values()).sort((a, b) =>
      b.lastSeenAt.localeCompare(a.lastSeenAt),
    );
  }

  clear(): void {
    this.challenges.clear();
  }
}

let instance: AuthRecoveryManager | null = null;

export function getAuthRecoveryManager(): AuthRecoveryManager {
  if (!instance) {
    instance = new AuthRecoveryManager();
  }
  return instance;
}
