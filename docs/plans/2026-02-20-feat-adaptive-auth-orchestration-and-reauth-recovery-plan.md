---
title: feat: Adaptive Auth Orchestration and Reauth Recovery
type: feat
status: active
date: 2026-02-20
---

# feat: Adaptive Auth Orchestration and Reauth Recovery

## Overview

Upgrade MCP Router authentication UX and reliability so stale/expired auth no longer depends on client-specific tool-calling behavior. Router becomes the auth orchestrator across interactive desktop and headless agent/server contexts.

## Problem Statement / Motivation

Current behavior is fragmented:
- Some tools rely on client-driven auth triggering, which is inconsistent across clients.
- Reauth often fails to open browser or fails silently.
- Headless contexts cannot rely on browser-first assumptions.
- Auth failures and transport reconnect failures are conflated, leading to poor recovery UX.

This conflicts with product vision goals: universal access, always-on operation, and low-friction multi-client reliability.

## Proposed Solution

Implement an adaptive, policy-driven auth orchestration model:

1. Router detects auth-expired/auth-required failures centrally.
2. Router classifies each server by auth mode:
   - `human_required`
   - `agent_refreshable`
   - `hybrid`
3. Router executes context-aware recovery:
   - Interactive mode: browser launch + actionable UX.
   - Headless mode: structured `auth_challenge` event + secure auth link + notification channel escalation.
4. Router queues/retries eligible failed calls after auth recovery.
5. Router exposes explicit auth health state and recovery telemetry via system tools/UI.

## Technical Considerations

- OAuth 2.1-first posture where supported by upstream server/provider.
- Preserve existing bearer-token/manual auth compatibility for non-OAuth servers.
- Avoid duplicate auth loops with backoff, cooldown, and deduped challenge IDs.
- Ensure secrets are never leaked in event payloads/logging.
- Keep per-server policy configurable (global defaults + server override).

## System-Wide Impact

- **Interaction graph**: Tool execution -> error classifier -> auth orchestrator -> recovery lane (interactive/headless) -> retry queue -> completion/failure.
- **Error propagation**: auth errors become typed recovery states, not generic tool failures.
- **State lifecycle risks**: queued retries must be idempotent-aware and bounded.
- **API surface parity**: system tools should expose auth state/challenges for agents.
- **Integration test scenarios**: expired token, revoked token, provider outage, browser-launch denied, headless escalation.

## Acceptance Criteria

- [ ] Router detects and classifies auth-expired/auth-required errors for configured servers.
- [ ] Interactive mode auto-launches auth flow (debounced) and surfaces clear state transitions.
- [ ] Headless mode emits `auth_challenge` events with secure completion URL and notification hooks.
- [ ] Router retries queued eligible tool calls after successful auth recovery.
- [ ] Router exposes auth recovery status via system API/tooling.
- [ ] Tests cover interactive and headless recovery paths and retry safeguards.

## Success Metrics

- Reduced auth-related tool failure rate across supported servers.
- Reduced manual user intervention per auth expiry event.
- Increased post-expiry task completion rate (retry success after reauth).
- Lower repeated support incidents for stale auth/session confusion.

## Dependencies & Risks

- Upstream server/provider auth capabilities vary.
- Some providers require unavoidable human steps (consent/MFA/CAPTCHA).
- Browser launch can fail due to host policy; must have fallback UX.
- Retry queues can cause duplicate side effects without idempotency controls.

## Implementation Phases (YAGNI-first)

### Phase 1: Auth Error Classification + State Machine
- Typed auth failure classifier.
- Per-server auth mode metadata.
- Core auth state machine (`healthy`, `refreshing`, `action_required`, `recovered`, `failed`).

### Phase 2: Recovery Lanes
- Interactive browser-launch orchestration.
- Headless `auth_challenge` emission + escalation hooks.
- Recovery telemetry in logs and system APIs.

### Phase 3: Retry/Resume
- Retry queue for eligible failed requests.
- Cooldown/backoff safeguards.
- Idempotency policy + unsafe-call exclusions.

### Phase 4: UX + Operations
- UI status surfaces for auth state and pending actions.
- Operational metrics/events for auth churn.
- Docs: provider compatibility matrix and operator runbook.

## Auth Mode Matrix

| Mode | Typical Provider Pattern | Primary Recovery | Fallback |
|---|---|---|---|
| `human_required` | Browser OAuth consent + MFA | Open browser/auth URL and await completion | Send challenge link to human channel |
| `agent_refreshable` | Refresh token/service account | Silent token refresh by router/agent | Escalate to human if refresh fails repeatedly |
| `hybrid` | Mixed scope/token policies | Attempt silent refresh first | Human challenge if needed |

## Open Questions

- Channel priority for headless human escalation by default (Slack vs Telegram vs both).
- Which servers are in first rollout cohort (workspace, notion, supabase, exa, etc.).
- Retry eligibility defaults for non-idempotent tools.

## References & Research

### Internal
- `docs/brainstorms/2026-02-20-mcp-client-connection-self-healing-brainstorm.md`
- `docs/plans/2026-02-20-feat-client-session-self-healing-plan.md`
- `apps/electron/src/main/modules/mcp-server-manager/reconnecting-mcp-client.ts`
- `apps/electron/src/main/modules/system-server/system-server.ts`
- `VISION.md` (external working copy used for roadmap alignment)

### External
- MCP Transports Spec (session behavior): https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
- MCP Authorization Spec (OAuth 2.1 guidance): https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization
- MCP client registration notes: https://blog.modelcontextprotocol.io/posts/client_registration/
- Anthropic MCP docs: https://docs.anthropic.com/en/docs/claude-code/mcp
- OAuth Device Flow (headless pattern): https://datatracker.ietf.org/doc/rfc8628/

## Deepen Plan Notes (Spec/Flow Analysis)

### Critical Edge Cases

- Expired auth and stale session happen together: recovery must not race or loop.
- Browser launch succeeds but callback never returns: challenge timeout and resumable status required.
- Multiple clients trigger same auth failure simultaneously: deduplicate by server + auth challenge fingerprint.
- Token refresh works but tool replay fails: preserve original error and retry audit trail.
- Headless agent has no configured escalation channel: return deterministic operator action-needed state.

### Non-Goals (Initial Release)

- Full provider-specific OAuth adapters for every MCP server.
- Automatic completion of human-only consent flows.
- Cross-machine distributed retry queues.

### Rollout Strategy

1. Feature flag enabled for internal workspace.
2. Canary on top auth-sensitive servers.
3. Gradual default enablement with telemetry guardrails.

### Validation Requirements

- Integration tests with simulated auth expiry and recovery.
- Stress tests for concurrent auth challenges.
- Manual QA: desktop interactive flow and headless escalation flow.
