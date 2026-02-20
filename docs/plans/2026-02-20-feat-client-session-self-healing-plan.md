---
title: feat: Client Session Self-Healing After Router Restart
type: feat
status: active
date: 2026-02-20
---

# feat: Client Session Self-Healing After Router Restart

## Overview

Improve MCP Router reliability when multiple MCP clients stay open while the router restarts. The router should recover client connectivity automatically when possible and provide deterministic fallback behavior when clients are non-compliant.

## Problem Statement / Motivation

Current streamable HTTP behavior returns `404 Session not found or expired` when a client reuses a stale `mcp-session-id` after router restart. This is protocol-valid but creates operational instability for long-running clients that do not always reinitialize correctly without manual intervention.

## Proposed Solution

Introduce compatibility-first session self-healing on the router transport boundary:

1. Add **auto-create-on-invalid-session** behavior (enabled by default).
2. When a stale `mcp-session-id` is received, transparently rotate to a fresh session (instead of immediate hard 404), when policy allows.
3. Emit recovery metadata and logs so operators and agents can detect recovery and guide next actions.
4. Keep a strict/spec-compliant mode available for environments that require strict 404 semantics.

## Technical Considerations

- Must preserve MCP compatibility while improving practical recovery.
- Must avoid creating new sessions for destructive cleanup calls (e.g. stale DELETE).
- Must preserve rate-limit and max-session protections.
- Must avoid leaking auth/session internals in recovery headers.

## System-Wide Impact

- **Interaction graph**: `/mcp` transport resolution -> session lookup -> stale-session branch -> new transport allocation -> request handling.
- **Error propagation**: invalid stale-session path should become recoverable for compatible mode, strict failure in strict mode.
- **State lifecycle risks**: increased session churn if non-compliant clients flood stale IDs; rate-limiter and max sessions mitigate.
- **API surface parity**: setting should be visible in agent-manageable settings APIs.
- **Integration test scenarios**: stale session POST/GET/DELETE behavior, strict mode behavior, rate limit interactions.

## Acceptance Criteria

- [ ] Stale client session after router restart can recover without manual client restart in compatibility mode.
- [ ] Strict mode preserves 404 behavior for invalid session IDs.
- [ ] Recovery path is observable in logs/metadata.
- [ ] Typecheck and targeted tests pass.

## Success Metrics

- Reduced user-reported reconnect failures after router restart.
- Increased successful post-restart request recovery for known clients.
- Lower manual client restart requirement in mixed-client workflows.

## Dependencies & Risks

- Depends on client behavior; some clients may still require explicit reinitialize.
- Risk of masking protocol bugs in clients if compatibility mode is too permissive.

## Implementation Slice (YAGNI-first)

Phase 1 (this change):
- Add settings flag: `autoCreateSessionOnInvalidId` (default true).
- Implement stale-session recovery branch in HTTP streamable transport resolver.
- Add strict-mode fallback and headers/log hints.
- Add targeted tests for stale-session handling policy.

Phase 2 (follow-up):
- Add recovery state telemetry in UI/status endpoints.
- Add per-client policy override if needed.

## Behavior Matrix (Deepen)

| Request Shape | Compatibility Mode (`autoCreateSessionOnInvalidId=true`) | Strict Mode (`false`) |
|---|---|---|
| `POST /mcp` with stale `mcp-session-id` | Create fresh session and continue request | Return 404 session not found |
| `GET /mcp` with stale `mcp-session-id` | Create fresh session and continue stream setup | Return 404 session not found |
| `DELETE /mcp` with stale `mcp-session-id` | Return 404 (do not create new session) | Return 404 session not found |

Recovery metadata:
- Response headers on recovered requests:
  - `x-mcp-router-session-recovered: true`
  - `x-mcp-router-recovery-mode: compatibility`

## References & Research

- Existing reconnect architecture: `docs/plans/2026-01-30-connection-health-auto-reconnect.md`
- Relevant runtime files:
  - `apps/electron/src/main/modules/mcp-server-runtime/http/mcp-http-server.ts`
  - `apps/electron/src/main/modules/mcp-server-runtime/aggregator-server.ts`
  - `apps/electron/src/main/modules/system-server/system-server.ts`
  - `packages/shared/src/types/settings-types.ts`
- External context:
  - MCP streamable HTTP strict invalid session handling (404 expectation).
  - Practical compatibility precedent: auto-create on invalid session used by ecosystem servers.
