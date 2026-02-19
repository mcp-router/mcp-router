---
status: completed
priority: p2
issue_id: "108"
tags: [code-review, typescript, bug]
dependencies: []
---

# SamplingProxy.createMessage() Mutates Caller Parameters

`SamplingProxy.createMessage()` directly mutates the `params.maxTokens` field, causing side effects for callers who retry or log the original request.

## Problem Statement

At lines 64-66 of `sampling-proxy.ts`, the `createMessage()` method directly modifies the incoming `params` object by capping `params.maxTokens`. Because JavaScript objects are passed by reference, this mutation is visible to all callers holding a reference to the same params object. This causes:
1. Callers who retry the request see the capped value, not the original.
2. Logging or telemetry that captures params after the call records the mutated value.
3. Violates the principle of least surprise -- callers do not expect their input objects to be modified.

## Findings

- `apps/electron/src/main/modules/mcp-server-runtime/sampling-proxy.ts` line 65-66:
  ```typescript
  if (params.maxTokens > MAX_SAMPLING_TOKENS) {
    params.maxTokens = MAX_SAMPLING_TOKENS;
  }
  ```
- The `params` object is the caller's reference -- no copy is made before mutation.
- `MAX_SAMPLING_TOKENS` is a rate-limiting constant. The cap is correct behavior, but the mutation is the bug.
- Any caller that passes a request object and later inspects it (for logging, retry, or debugging) will see the mutated value.

**Location:**
- `apps/electron/src/main/modules/mcp-server-runtime/sampling-proxy.ts` lines 64-66

## Proposed Solutions

### Option 1: Shallow copy before capping (recommended)

**Approach:** Create a shallow copy of params before applying the cap:
```typescript
const safeParams = { ...params, maxTokens: Math.min(params.maxTokens, MAX_SAMPLING_TOKENS) };
return await this.activeServer.createMessage(safeParams);
```

**Pros:**
- One-line fix
- Zero impact on callers
- Preserves original params for logging/retry
- Clear intent

**Cons:**
- Allocates a new object per call (negligible cost)

**Effort:** 15 minutes

**Risk:** Low

---

### Option 2: Deep clone params

**Approach:** Use `structuredClone(params)` or a deep-clone utility to create a fully independent copy.

**Pros:**
- Protects against nested mutations if any exist
- Future-proof

**Cons:**
- `structuredClone` has higher overhead than spread
- Overkill for this case -- only `maxTokens` is modified

**Effort:** 15 minutes

**Risk:** Low

---

### Option 3: Make params readonly via TypeScript

**Approach:** Type the parameter as `Readonly<CreateMessageRequestParams>` and let the compiler catch mutations.

**Pros:**
- Prevents future mutations at compile time
- Documents intent

**Cons:**
- Does not fix the runtime mutation -- still need the copy
- `Readonly` is shallow, does not protect nested objects

**Effort:** 30 minutes (combine with Option 1)

**Risk:** Low

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/mcp-server-runtime/sampling-proxy.ts` lines 64-66

**Related components:**
- `SamplingProxy` class -- manages sampling request forwarding
- Any caller of `createMessage()` that retains a reference to the params object
- Token budget / rate limiting logic

## Acceptance Criteria

- [x] `params` object is not mutated by `createMessage()`
- [x] `maxTokens` is still capped at `MAX_SAMPLING_TOKENS` in the forwarded request
- [x] Callers retain original `maxTokens` value after the call returns
- [x] `pnpm typecheck` passes
- [x] Existing sampling tests pass (if any)

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Code Review

**Actions:**
- Identified direct mutation of caller params in sampling-proxy.ts
- Confirmed `params` is passed by reference with no copy
- Assessed impact on retry and logging scenarios

**Learnings:**
- Parameter mutation is a common JavaScript footgun in middleware-style code
- Shallow spread is sufficient since only a top-level field is modified

### 2026-02-19 - Resolution

**By:** Codex

**Actions:**
- Updated `SamplingProxy.createMessage()` to construct `safeParams` via object spread and capped `maxTokens` on the copy only.
- Preserved caller-owned request object immutability while maintaining the token cap behavior.
- Validated with `pnpm turbo run typecheck` and `pnpm --filter @mcp_router/electron test`.

**Learnings:**
- Keeping request payloads immutable by default also simplified follow-on session-aware routing changes.

## Resources
