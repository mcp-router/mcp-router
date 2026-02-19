---
status: complete
priority: p2
issue_id: "118"
tags: [code-review, performance]
dependencies: []
---

# Token Estimator Uses JSON.stringify on Every Request and Response

The token estimator calls `JSON.stringify` on every MCP request and response for heuristic token counting. For large payloads (megabytes of text or images), this blocks the event loop.

## Problem Statement

`token-estimator.ts` uses `JSON.stringify` as a proxy for size estimation:
- `estimateRequestTokens()` (line 57-63): `JSON.stringify(request)` on every incoming request.
- `estimateResponseTokens()` (line 69-75): `JSON.stringify(response)` on every outgoing response.
- `estimateToolTokens()` (line 41): `JSON.stringify(tool.inputSchema)` per tool.

`JSON.stringify` creates a complete string representation of the object, which:
1. Allocates a new string proportional to the object size.
2. Blocks the event loop for the duration of serialization.
3. For large responses (e.g., file contents, images, large JSON datasets), can take 50-100ms+ and allocate significant memory.
4. The string is immediately discarded after measuring its `.length` -- pure waste.

## Findings

- `apps/electron/src/main/modules/mcp-server-runtime/token-estimator.ts`:
  - Line 41: `charCount += JSON.stringify(tool.inputSchema).length;`
  - Line 59: `const serialized = JSON.stringify(request);`
  - Line 71: `const serialized = JSON.stringify(response);`
- These functions are called on every MCP request/response through the token budget tracking system.
- For a 1MB response, `JSON.stringify` allocates ~1MB of string data, measures its length, then discards it.
- The token estimation is heuristic (divides char count by ~4), so precise serialization is unnecessary.

**Location:**
- `apps/electron/src/main/modules/mcp-server-runtime/token-estimator.ts` lines 41, 57-63, 69-75

## Proposed Solutions

### Option 1: Recursive size estimation without string allocation (recommended)

**Approach:** Walk the object tree recursively, summing estimated sizes without creating intermediate strings:
```typescript
function estimateObjectSize(obj: unknown): number {
  if (obj === null || obj === undefined) return 4;
  if (typeof obj === 'string') return obj.length + 2; // quotes
  if (typeof obj === 'number') return String(obj).length;
  if (typeof obj === 'boolean') return obj ? 4 : 5;
  if (Array.isArray(obj)) {
    let size = 2; // brackets
    for (const item of obj) size += estimateObjectSize(item) + 1;
    return size;
  }
  if (typeof obj === 'object') {
    let size = 2; // braces
    for (const [key, value] of Object.entries(obj)) {
      size += key.length + 3 + estimateObjectSize(value) + 1;
    }
    return size;
  }
  return 10; // fallback
}
```

**Pros:**
- Zero string allocation
- Proportional to object structure, not serialized size
- Can short-circuit on large objects (bail out after a threshold)
- Still accurate enough for heuristic token estimation

**Cons:**
- Custom implementation to maintain
- Edge cases (circular references, symbols, BigInt) need handling
- Slightly less precise than full serialization (irrelevant for heuristic)

**Effort:** 2-3 hours

**Risk:** Low

---

### Option 2: Sample-based estimation

**Approach:** For objects over a size threshold, sample a subset of keys/values and extrapolate the total size.

**Pros:**
- Constant-time for arbitrarily large objects
- Very low memory overhead

**Cons:**
- Less accurate for heterogeneous objects
- Sampling logic adds complexity
- May over or underestimate significantly

**Effort:** 2-3 hours

**Risk:** Medium

---

### Option 3: Async serialization in worker thread

**Approach:** Move `JSON.stringify` to a worker thread so it does not block the main event loop.

**Pros:**
- No change to estimation accuracy
- Event loop remains responsive

**Cons:**
- Worker thread overhead (message passing, serialization for transfer)
- Still allocates the full string (memory issue remains)
- Adds complexity for a heuristic function

**Effort:** 4-6 hours

**Risk:** Medium

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/mcp-server-runtime/token-estimator.ts` lines 41, 57-76

**Related components:**
- Token budget tracking system (consumer of estimates)
- Request/response pipeline (where estimator is called)
- Rate limiter (may depend on token estimates)

## Acceptance Criteria

- [ ] Token estimation does not call `JSON.stringify` on request/response objects
- [ ] No large string allocations during estimation
- [ ] Event loop blocking reduced to <5ms for 1MB payloads
- [ ] Token estimates remain within 20% accuracy of the previous method
- [ ] `pnpm typecheck` passes
- [ ] Circular reference inputs do not cause infinite loops or crashes

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Code Review

**Actions:**
- Identified `JSON.stringify` calls in token-estimator.ts
- Confirmed they run on every request and response
- Assessed memory and CPU impact for large payloads
- Reviewed the heuristic nature of the estimation (chars / 4)

**Learnings:**
- The estimation is intentionally approximate -- high precision is not needed
- `JSON.stringify` is the most expensive way to measure object size

## Resources

### 2026-02-19 - Backlog Closure

**By:** Codex

**Disposition:** deferred-tech-debt

**Notes:** Closed as deferred technical debt after review; requires larger architectural or product-scope changes beyond this hardening pass.
