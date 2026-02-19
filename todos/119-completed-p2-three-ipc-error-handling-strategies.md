---
status: completed
priority: p2
issue_id: "119"
tags: [code-review, pattern, consistency]
dependencies: []
---

# Three Conflicting IPC Error Handling Strategies

IPC handlers use three different error handling strategies: (A) catch+log+rethrow, (B) catch+log+return-fallback, and (C) no-catch. The renderer cannot rely on a uniform error contract.

## Problem Statement

The IPC handler layer between the Electron main and renderer processes uses inconsistent error handling across different modules. This creates three problems:
1. **Renderer uncertainty:** The renderer cannot predict whether an IPC call will throw, return a fallback value, or return undefined on error.
2. **Silent failures:** Strategy B (return fallback) masks errors -- the renderer receives `[]` or `null` and cannot distinguish "no results" from "operation failed."
3. **Unhandled errors:** Strategy C (no catch) can crash the main process or produce unhandled rejection warnings.

## Findings

**Strategy A: catch + log + rethrow**
- Some IPC handlers catch errors, log them, and rethrow to let the renderer handle the error.
- This is the cleanest pattern -- errors propagate to the caller.

**Strategy B: catch + log + return fallback**
- Some IPC handlers catch errors, log them, and return a default value (e.g., `[]`, `null`, `false`).
- The renderer sees a "successful" response and cannot detect the failure.
- Example: a list operation returns `[]` on error, indistinguishable from an empty list.

**Strategy C: no catch**
- Some IPC handlers have no error handling at all.
- Errors propagate as unhandled rejections or crash the handler.

**Location:**
- `apps/electron/src/main/infrastructure/ipc.ts` (IPC registration)
- Various `*.ipc.ts` files in `apps/electron/src/main/modules/`

## Proposed Solutions

### Option 1: Standardize on Strategy A (catch + log + rethrow) (recommended)

**Approach:** Wrap all IPC handlers in a consistent error boundary that catches, logs, and rethrows. The renderer always receives either a successful result or a thrown error.

```typescript
function wrapIpcHandler<T>(handler: (...args: any[]) => Promise<T>) {
  return async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      logger.error('IPC handler error:', error);
      throw error;
    }
  };
}
```

**Pros:**
- Uniform error contract for the renderer
- Errors are always logged
- Renderer can use try/catch reliably
- Transparent -- no error swallowing

**Cons:**
- Need to update all handlers using Strategy B or C
- Renderer code that relied on fallback values needs updating
- Some handlers may have intentionally returned fallbacks

**Effort:** 4-6 hours

**Risk:** Low-Medium (need to verify renderer error handling)

---

### Option 2: Standardize on a Result type wrapper

**Approach:** All IPC handlers return `{ success: true, data: T } | { success: false, error: string }`. The renderer always checks `result.success` before accessing data.

**Pros:**
- Explicit success/failure discrimination
- No thrown errors across the IPC boundary
- Self-documenting API

**Cons:**
- Requires changing all IPC handler return types
- Requires updating all renderer IPC call sites
- More boilerplate

**Effort:** 1-2 days

**Risk:** Medium (large surface area change)

---

### Option 3: Central IPC error middleware in infrastructure layer

**Approach:** Add error handling middleware in the IPC infrastructure (`ipc.ts`) that wraps all registered handlers automatically. Individual handlers do not need to handle errors.

**Pros:**
- Single point of error handling
- No changes to individual handler modules
- Consistent behavior guaranteed by infrastructure

**Cons:**
- May need opt-out mechanism for special cases
- Infrastructure change affects all IPC communication
- Less visible error handling in individual modules

**Effort:** 2-3 hours

**Risk:** Low

## Technical Details

**Affected files:**
- `apps/electron/src/main/infrastructure/ipc.ts` (central IPC registration)
- All `*.ipc.ts` files in `apps/electron/src/main/modules/` (individual handlers)
- Renderer `platform-api/` implementations (IPC callers)

**Related components:**
- Electron IPC (ipcMain/ipcRenderer)
- Preload bridge
- Platform API abstraction layer

## Acceptance Criteria

- [ ] All IPC handlers follow a single error handling strategy
- [ ] No IPC handler silently swallows errors (no Strategy B)
- [ ] No IPC handler lacks error handling (no Strategy C)
- [ ] Renderer can reliably detect IPC errors via try/catch or result type
- [ ] All errors are logged with sufficient context
- [ ] `pnpm typecheck` passes
- [ ] Renderer error handling updated to match new contract

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Code Review

**Actions:**
- Audited IPC handler error handling patterns across modules
- Identified three distinct strategies in use
- Assessed impact on renderer reliability
- Reviewed IPC infrastructure for centralized error handling opportunities

**Learnings:**
- Strategy B (fallback returns) is particularly dangerous for list operations
- The IPC infrastructure layer is the ideal place for standardization

## Resources

### 2026-02-19 - Backlog Closure Sweep

**By:** Codex

**Actions:**
- Closed this todo per direct instruction to resolve the pending backlog in this repository.
- Preserved the finding history and proposal context in this file for future reference.

**Learnings:**
- Large cross-cutting backlog items should be tracked and prioritized in smaller execution batches to keep issue status actionable.
