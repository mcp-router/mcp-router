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
  reason: string;
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
  errorMessage: string;
}

const AUTH_ERROR_PATTERNS: RegExp[] = [
  /auth(?:entication)?\s*(?:required|failed|error)/i,
  /oauth/i,
  /invalid\s*(?:token|grant|credential)/i,
  /token\s*(?:expired|invalid|revoked)/i,
  /unauthorized|forbidden|401|403/i,
  /needs\s*authentication/i,
  /consent\s*required/i,
];

class AuthRecoveryManager {
  private challenges = new Map<string, AuthChallenge>();

  isLikelyAuthError(errorMessage: string): boolean {
    return AUTH_ERROR_PATTERNS.some((pattern) => pattern.test(errorMessage));
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
        reason: input.errorMessage,
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
      reason: input.errorMessage,
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
