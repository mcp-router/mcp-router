/**
 * Manages elicitation state for proxy passthrough
 */
import type { ElicitationState, ElicitationMode } from "@mcp_router/shared";

const ELICITATION_TTL_MS = 10 * 60 * 1000; // 10 minutes

class ElicitationManager {
  private states: Map<string, ElicitationState> = new Map();

  /**
   * Create a new elicitation state entry
   */
  public createElicitation(
    elicitationId: string,
    clientSessionId: string,
    backendServerId: string,
    mode: ElicitationMode,
  ): ElicitationState {
    this.cleanupExpired();

    const state: ElicitationState = {
      elicitationId,
      clientSessionId,
      backendServerId,
      mode,
      createdAt: Date.now(),
      status: "pending",
    };

    this.states.set(elicitationId, state);
    return state;
  }

  /**
   * Get elicitation state by ID
   */
  public getElicitation(elicitationId: string): ElicitationState | undefined {
    const state = this.states.get(elicitationId);
    if (!state) return undefined;

    // Check if expired
    if (Date.now() - state.createdAt > ELICITATION_TTL_MS) {
      state.status = "expired";
      this.states.delete(elicitationId);
      return undefined;
    }

    return state;
  }

  /**
   * Mark elicitation as completed
   */
  public completeElicitation(elicitationId: string): boolean {
    const state = this.states.get(elicitationId);
    if (!state) return false;

    state.status = "completed";
    this.states.delete(elicitationId);
    return true;
  }

  /**
   * Cancel an elicitation
   */
  public cancelElicitation(elicitationId: string): boolean {
    const state = this.states.get(elicitationId);
    if (!state) return false;

    state.status = "cancelled";
    this.states.delete(elicitationId);
    return true;
  }

  /**
   * Get client session for an elicitation (for notification routing)
   */
  public getClientSession(elicitationId: string): string | undefined {
    return this.getElicitation(elicitationId)?.clientSessionId;
  }

  /**
   * Get backend server for an elicitation (for forwarding)
   */
  public getBackendServer(elicitationId: string): string | undefined {
    return this.getElicitation(elicitationId)?.backendServerId;
  }

  /**
   * Cleanup expired elicitations
   */
  private cleanupExpired(): void {
    const now = Date.now();
    for (const [id, state] of this.states) {
      if (now - state.createdAt > ELICITATION_TTL_MS) {
        this.states.delete(id);
      }
    }
  }
}

// Singleton instance
let instance: ElicitationManager | null = null;

export function getElicitationManager(): ElicitationManager {
  if (!instance) {
    instance = new ElicitationManager();
  }
  return instance;
}
