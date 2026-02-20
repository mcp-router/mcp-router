---
status: complete
priority: p2
issue_id: "143"
tags: [code-review, reliability, auth, mcp, architecture]
dependencies: []
---

# Tighten Auth Error Classification To Avoid False Positives

Auth challenge creation is triggered by broad regex matching on error message text. Current patterns include generic `forbidden|401|403`, which can classify non-auth issues (authorization policy, permissions, gateway responses) as re-auth-required. This can mislead operators and agents.

## Findings

- `apps/electron/src/main/modules/mcp-server-runtime/auth-recovery-manager.ts:30-38` uses broad regex heuristics.
- `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts:1038` triggers auth challenge state on regex match.
- `apps/electron/src/main/modules/tool-catalog/tool-catalog-handler.ts:619` applies same classification in catalog execution path.
- Result: re-auth guidance may be shown for access-control or non-recoverable policy failures, creating churn and unnecessary browser/auth flows.

## Proposed Solutions

### Option 1: Introduce Typed Auth Error Contract + Fallback Heuristics

**Approach:** Prefer structured error metadata (`errorType`, `status`, provider code) from upstream calls; use regex only as fallback.

**Pros:**
- Better precision
- Clear separation between auth expiry vs authorization denial

**Cons:**
- Requires incremental integration work with upstream error sources

**Effort:** 4-6 hours

**Risk:** Medium

---

### Option 2: Restrict Regex to Expiry/Token/Consent Signatures Only

**Approach:** Remove generic `forbidden|401|403` and keep only explicit auth-expiry indicators (`token expired`, `invalid_grant`, `consent required`).

**Pros:**
- Fast mitigation
- Lower false-positive rate immediately

**Cons:**
- May miss some provider-specific auth errors until patterns expanded

**Effort:** 1-2 hours

**Risk:** Low

## Recommended Action
Implemented Option 2 with a classifier upgrade path. Removed broad 403/forbidden matching from auth-expiry classification and introduced structured classifier output to support future typed upstream contracts.

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/mcp-server-runtime/auth-recovery-manager.ts`
- `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts`
- `apps/electron/src/main/modules/tool-catalog/tool-catalog-handler.ts`

**Related components:**
- `router_auth_status` and `auth_challenge` lifecycle
- Router-level recovery guidance UX

## Resources

- Commit: `c571dbc`
- MCP auth guidance: https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization

## Acceptance Criteria

- [x] Classifier distinguishes auth-expiry from authorization-policy errors
- [x] False-positive paths do not create auth challenges
- [x] Tests cover 401/403 non-expiry scenarios and true expiry scenarios

## Work Log

### 2026-02-20 - Initial Discovery

**By:** Codex

**Actions:**
- Reviewed classifier patterns and call sites
- Compared failure classes against intended auth orchestration behavior

**Learnings:**
- Message-regex-only classification is fragile under heterogeneous providers
- Minimal narrowing can reduce risk quickly while typed contracts are introduced

### 2026-02-20 - Resolution

**By:** Codex

**Actions:**
- Replaced boolean `isLikelyAuthError` with structured `classifyAuthError`
- Added explicit token/oauth/consent signatures and removed generic forbidden/403 trigger
- Updated both legacy and catalog execution paths to use classifier output
- Extended tests for 401 auth-expiry and 403 policy non-auth behavior

**Learnings:**
- Conservative classification reduces noisy reauth loops and improves operator trust.

## Notes

- This is a reliability/usability issue that can cascade into unnecessary reauth prompts.
