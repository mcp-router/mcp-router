---
status: pending
priority: p3
issue_id: "126"
tags: [code-review, dead-code]
dependencies: []
---

# Task Registry Contains Unused Methods

## Problem Statement

`TaskRegistry` (155 lines) exposes `listTasks`, `updateStatus`, `removeTask` methods and a `parseNamespacedTaskId` helper function that are never called from anywhere in the codebase. Only `registerTask`, `getTask`, and `getServerForTask` are actually used. The unused methods represent dead code that adds maintenance burden.

## Findings

- `apps/electron/src/main/modules/mcp-server-runtime/task-registry.ts` -- 155 lines total
- **Used methods:** `registerTask()`, `getTask()`, `getServerForTask()` -- called from request handlers and system server
- **Unused methods (zero callers):**
  - `listTasks()` -- lists all registered tasks
  - `updateStatus()` -- updates task status
  - `removeTask()` -- removes a task from registry
- **Unused function (zero callers):**
  - `parseNamespacedTaskId()` -- parses `serverId:taskId` format
- Also has hybrid singleton pattern (both `static getInstance()` and exported `getTaskRegistry()`) -- noted in todo #122
- Also missing `public` keyword on `getInstance` -- noted in todo #122

**Verification:** Grep for `listTasks|updateStatus|removeTask|parseNamespacedTaskId` returns only the task-registry.ts file itself.

## Proposed Solutions

### Option 1: Remove unused methods

**Approach:** Delete `listTasks()`, `updateStatus()`, `removeTask()`, and `parseNamespacedTaskId()`. This removes approximately 40-50 lines.

**Pros:**
- Reduces file from 155 to ~105 lines
- Eliminates dead code
- Methods are in version control if ever needed

**Cons:**
- These methods may be intended for future task management UI
- Would need to rewrite if tasks/roots feature evolves

**Effort:** 15 minutes

**Risk:** Low -- methods are never called

---

### Option 2: Mark as planned API surface

**Approach:** Add JSDoc `@internal` or `@planned` tags to indicate these methods are part of the planned task management feature but not yet wired up.

**Pros:**
- Preserves intended API surface
- Makes unused status explicit

**Cons:**
- Dead code remains

**Effort:** 10 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/mcp-server-runtime/task-registry.ts`

**Related components:**
- Request handlers (use `registerTask`, `getTask`, `getServerForTask`)
- System server (uses `getServerForTask`)
- Tasks/Roots MCP primitive support (todo #046, completed)

**Database changes:** None

## Resources

- **Related:** Todo #046 (tasks primitive support, completed)
- **Related:** Todo #122 (singleton pattern inconsistency)

## Acceptance Criteria

- [ ] Unused methods removed or explicitly marked as planned
- [ ] `parseNamespacedTaskId()` removed or marked
- [ ] No broken references after removal
- [ ] Used methods (`registerTask`, `getTask`, `getServerForTask`) unaffected

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Claude Code

**Actions:**
- Grepped for all method names -- confirmed `listTasks`, `updateStatus`, `removeTask`, `parseNamespacedTaskId` have zero external callers
- Verified `registerTask`, `getTask`, `getServerForTask` are actively used
- Counted ~40-50 lines of dead code

**Learnings:**
- Methods were likely added as part of tasks primitive implementation (todo #046) but never wired to IPC or UI

## Notes
