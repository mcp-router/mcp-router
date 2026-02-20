---
status: complete
priority: p2
issue_id: "140"
tags: [code-review, security, runtime, mcp]
dependencies: []
---

# Harden initialize payload validation for session recovery

POST stale-session recovery currently allows session re-creation when payload
`method` equals `"initialize"`, but does not validate key JSON-RPC envelope
properties. This can be hardened to reduce malformed-input acceptance and make
recovery behavior more explicit.

## Problem Statement

`isInitializeRequest` accepts any object with `method === "initialize"`.
It does not verify `jsonrpc === "2.0"` or method type constraints before
allowing stale-session recovery for POST requests.

This is not an active exploit, but it broadens accepted payload shapes at a
security boundary and increases ambiguity in recovery behavior.

## Findings

- `apps/electron/src/main/modules/mcp-server-runtime/http/session-recovery-policy.ts:27`
  `isInitializeRequest` only checks `payload.method === "initialize"`.
- `apps/electron/src/main/modules/mcp-server-runtime/http/session-recovery-policy.ts:16`
  Recovery decision for POST depends entirely on `isInitializeRequest(payload)`.
- The codebase has prior institutional guidance to keep strict validation at
  tool/runtime boundaries (`docs/solutions/code-quality/comprehensive-review-35-findings.md`).

## Proposed Solutions

### Option 1: Strict JSON-RPC shape check in helper

Pros:
- Minimal change footprint
- Stronger boundary validation
- Easy to unit-test

Cons:
- Slightly stricter behavior for non-standard clients

Effort: Small
Risk: Low

### Option 2: Schema-validate initialize payload

Pros:
- Explicit, reusable validation contract
- Better future maintainability

Cons:
- More code and dependency surface
- Potential overkill for current scope

Effort: Medium
Risk: Medium

## Recommended Action

Implemented Option 1: tightened `isInitializeRequest` to require a JSON-RPC 2.0 initialize envelope and added malformed-payload coverage.

## Technical Details

Affected files:
- `apps/electron/src/main/modules/mcp-server-runtime/http/session-recovery-policy.ts`
- `apps/electron/src/main/modules/mcp-server-runtime/http/__tests__/session-recovery-policy.test.ts`

## Resources

- PR: `https://github.com/cyberpapiii/mcp-router/pull/1`
- Known pattern: `docs/solutions/code-quality/comprehensive-review-35-findings.md`

## Acceptance Criteria

- [ ] POST recovery requires valid JSON-RPC 2.0 initialize envelope
- [ ] Malformed initialize-shaped payloads do not trigger auto-recovery
- [ ] Tests cover valid and invalid payload variants
- [ ] Existing session recovery tests remain green

## Work Log

### 2026-02-20 - Review finding created

By: Codex workflows-review

Actions:
- Reviewed stale-session recovery path and helper checks
- Identified boundary-hardening opportunity
- Logged mitigation options and acceptance criteria


### 2026-02-20 - Implemented

By: Codex workflows-work

Actions:
- Implemented code changes and tests
- Ran targeted Electron tests and monorepo typecheck
- Verified no type errors and green test run
