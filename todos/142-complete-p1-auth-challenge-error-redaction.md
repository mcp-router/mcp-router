---
status: complete
priority: p1
issue_id: "142"
tags: [code-review, security, auth, mcp]
dependencies: []
---

# Redact Sensitive Upstream Error Details From Auth Challenge State

`router_auth_status` currently returns raw upstream error text captured during auth failures. Upstream error strings can include sensitive details (auth URLs, provider internals, token fragments), creating unnecessary secret exposure to any caller with server-scoped token access.

## Findings

- `apps/electron/src/main/modules/mcp-server-runtime/auth-recovery-manager.ts:14` stores `reason` as arbitrary string from upstream failures.
- `apps/electron/src/main/modules/mcp-server-runtime/auth-recovery-manager.ts:58` and `apps/electron/src/main/modules/mcp-server-runtime/auth-recovery-manager.ts:78` persist raw `errorMessage` directly.
- `apps/electron/src/main/modules/system-server/system-server.ts:1128` returns `challenges` (including `reason`) via `router_auth_status`.
- This violates existing institutional guidance to avoid credential/token leakage in logs/diagnostics (`docs/solutions/code-quality/REVIEW_QUICK_START.md`).

## Proposed Solutions

### Option 1: Store and Return Sanitized Reason Only

**Approach:** Normalize error into a safe enum/message (e.g., `auth_required`, `token_expired`, `consent_required`) and never persist raw text in challenge state.

**Pros:**
- Strongest safety guarantee
- Stable machine-readable recovery semantics

**Cons:**
- Less raw debugging detail

**Effort:** 2-3 hours

**Risk:** Low

---

### Option 2: Keep Raw Reason Internally, Expose Redacted Reason Externally

**Approach:** Maintain private raw message for local diagnostics, but return only scrubbed text through `router_auth_status`.

**Pros:**
- Preserves debugging context
- Reduces external leakage risk

**Cons:**
- Requires strict separation and audit discipline

**Effort:** 3-4 hours

**Risk:** Medium

## Recommended Action
Implemented Option 1. Store and expose sanitized auth reason metadata only (`reasonCode`, `reasonSummary`) and remove raw upstream error payloads from challenge state.

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/mcp-server-runtime/auth-recovery-manager.ts`
- `apps/electron/src/main/modules/system-server/system-server.ts`

**Related components:**
- Event bridge (`auth_challenge` events)
- System server API surface (`router_auth_status`)

## Resources

- Commit: `c571dbc`
- Institutional review guidance: `docs/solutions/code-quality/REVIEW_QUICK_START.md`
- Security context: `docs/solutions/code-quality/codebase-review-institutional-knowledge.md`

## Acceptance Criteria

- [x] `router_auth_status` never exposes raw upstream auth error payloads
- [x] Reason values are normalized/sanitized
- [x] Unit test covers redaction/sanitization behavior
- [x] Existing auth recovery flows still work

## Work Log

### 2026-02-20 - Initial Discovery

**By:** Codex

**Actions:**
- Reviewed auth challenge lifecycle in new auth recovery manager
- Traced challenge serialization path to system tool output
- Identified raw upstream error propagation into public tool output

**Learnings:**
- New auth status observability is valuable but currently overexposes failure detail
- Existing project standards emphasize strict token/secret non-disclosure

### 2026-02-20 - Resolution

**By:** Codex

**Actions:**
- Replaced raw challenge `reason` with sanitized `reasonCode` + `reasonSummary`
- Updated registration call sites to persist classification output instead of raw errors
- Added/updated tests to assert no raw `reason` field is present and sanitized values are used

**Learnings:**
- Structured reason codes are safer and improve downstream agent determinism.

## Notes

- This finding is blocking for production hardening because it expands auth-related data exposure surface.
