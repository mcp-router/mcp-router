---
status: complete
priority: p3
issue_id: "141"
tags: [code-review, quality, testing, runtime]
dependencies: []
---

# Add HTTP coverage for reinitialize-required response signals

When stale session recovery is not performed, the HTTP layer emits a 404 with
`x-mcp-router-reinitialize-required: true` and a JSON-RPC error payload. This
behavior is currently not asserted by automated tests.

## Problem Statement

A regression could silently remove or alter the response header/body contract
used by clients to detect reinitialization requirements.

## Findings

- `apps/electron/src/main/modules/mcp-server-runtime/http/mcp-http-server.ts:258`
  sets `x-mcp-router-reinitialize-required` header.
- `apps/electron/src/main/modules/mcp-server-runtime/http/mcp-http-server.ts:259`
  returns JSON-RPC 404 error body (`reinitialize required`).
- No direct test currently asserts this exact contract at HTTP boundary.

## Proposed Solutions

### Option 1: Add focused integration-style HTTP test

Pros:
- Validates real transport behavior
- Protects header + payload contract

Cons:
- Slightly more setup than pure unit test

Effort: Small
Risk: Low

### Option 2: Unit-test helper only (status quo transport untested)

Pros:
- Fastest

Cons:
- Misses regression at actual HTTP response layer

Effort: Small
Risk: Medium

## Recommended Action

Implemented by extracting a shared response contract helper and asserting exact header/payload values in tests used by the HTTP transport.

## Technical Details

Affected files:
- `apps/electron/src/main/modules/mcp-server-runtime/http/mcp-http-server.ts`
- `apps/electron/src/main/modules/mcp-server-runtime/http/__tests__/...` (new or existing HTTP test suite)

## Resources

- PR: `https://github.com/cyberpapiii/mcp-router/pull/1`

## Acceptance Criteria

- [ ] Test verifies 404 on stale session when no recovery applies
- [ ] Test verifies `x-mcp-router-reinitialize-required: true`
- [ ] Test verifies JSON-RPC error structure and message contract
- [ ] Test runs in CI and is stable

## Work Log

### 2026-02-20 - Review finding created

By: Codex workflows-review

Actions:
- Reviewed stale-session 404 signaling path
- Identified missing transport-level assertion coverage
- Captured implementation options and criteria


### 2026-02-20 - Implemented

By: Codex workflows-work

Actions:
- Implemented code changes and tests
- Ran targeted Electron tests and monorepo typecheck
- Verified no type errors and green test run
