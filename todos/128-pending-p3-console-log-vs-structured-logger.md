---
status: pending
priority: p3
issue_id: "128"
tags: [code-review, logging, consistency]
dependencies: []
---

# Console.log Dominates Over Structured Logger (307 vs 19 Calls)

## Problem Statement

The codebase has 307 `console.*` calls across 49 files in the main process, but only 19 structured logger calls (`logInfo`/`logError`/`logWarn` from `@/main/utils/logger`) across 7 files. A structured logger exists and is functional but has negligible adoption. Request handlers use `console.log` on the hot path (multiple calls per request in `executeWithHooks` even when no workflows exist).

## Findings

**Console calls (307 total across 49 files):**
- Heaviest files:
  - `infrastructure/database/main-database-migration.ts` -- 76 calls (acceptable for migration logging)
  - `modules/skills/skills-file-manager.ts` -- 14 calls
  - `modules/mcp-server-manager/mcp-server-manager.ts` -- 14 calls
  - `modules/mcp-server-manager/mcp-server-manager.repository.ts` -- 12 calls
  - `infrastructure/database/sqlite-manager.ts` -- 12 calls
  - `modules/workflow/workflow-executor.ts` -- 12 calls
  - `modules/mcp-server-runtime/request-handler-base.ts` -- 10 calls
  - `modules/client-apps/client-app.ipc.ts` -- 10 calls
  - `modules/workflow/workflow.ipc.ts` -- 10 calls
  - `modules/workflow/hook.ipc.ts` -- 8 calls
  - `modules/mcp-server-runtime/http/mcp-http-server.ts` -- 8 calls
  - `modules/system/package/package-version-resolver.ts` -- 8 calls

**Structured logger calls (19 total across 7 files):**
- `utils/logger.ts` -- 3 (definitions)
- `modules/singleton-service.ts` -- 2
- `modules/mcp-server-manager/server-service.ts` -- 5
- `modules/mcp-logger/audit-log.service.ts` -- 2
- `modules/skills/__tests__/unified-skills.service.test.ts` -- 2
- `utils/env-utils.ts` -- 2
- `modules/system/package/package-version-resolver.ts` -- 3

**Hot path logging:**
- `request-handler-base.ts` has 10 console calls on the request path
- `workflow-executor.ts` logs 12 times during workflow execution
- `hook.ipc.ts` logs 8 times for hook operations
- These execute on every MCP request, producing noise in production

## Proposed Solutions

### Option 1: Migrate hot-path logging to conditional debug level

**Approach:** Replace `console.log` calls in request handlers, workflow executor, and IPC handlers with the structured logger at `debug` level (only visible when debug mode is enabled). Migrate error paths to `logError`. Leave migration logging and one-time startup logging as-is.

**Pros:**
- Reduces runtime log noise significantly
- Hot-path performance improves (no string formatting unless debug enabled)
- Error paths get structured logging (useful for diagnostics)
- Pragmatic -- does not require migrating all 307 calls

**Cons:**
- Partial migration (not all files)
- Two logging approaches still coexist

**Effort:** 3-4 hours

**Risk:** Low -- replacing console.log with conditional logger

---

### Option 2: Full migration to structured logger

**Approach:** Replace all 307 `console.*` calls with structured logger calls at appropriate levels (`debug`, `info`, `warn`, `error`). Add log levels to the structured logger if not already present.

**Pros:**
- Consistent logging across entire codebase
- Enables log level filtering in production
- Better diagnostics and potential log aggregation

**Cons:**
- Large mechanical change (49 files)
- Risk of regressions if log calls have side effects
- Migration logging may not benefit from structured format

**Effort:** 8-12 hours

**Risk:** Low-Medium -- large scope but mechanical changes

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `apps/electron/src/main/utils/logger.ts` -- structured logger implementation
- 49 files with `console.*` calls (see findings above for heaviest)
- Focus files for Option 1:
  - `apps/electron/src/main/modules/mcp-server-runtime/request-handler-base.ts`
  - `apps/electron/src/main/modules/workflow/workflow-executor.ts`
  - `apps/electron/src/main/modules/workflow/hook.ipc.ts`
  - `apps/electron/src/main/modules/workflow/workflow.ipc.ts`

**Related components:**
- Structured logger utility
- Request handler pipeline
- Workflow execution engine

**Database changes:** None

## Resources

- Structured logger: `apps/electron/src/main/utils/logger.ts`

## Acceptance Criteria

- [ ] Hot-path logging (request handlers, workflow executor) uses conditional debug-level logging
- [ ] Error paths use structured `logError` calls
- [ ] No performance degradation from logging on request hot path
- [ ] Existing diagnostic capability preserved or improved

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Claude Code

**Actions:**
- Counted 307 console.* calls across 49 files in main process
- Counted 19 structured logger calls across 7 files
- Identified top 12 files by console call count
- Identified hot-path files (request-handler-base, workflow-executor)

**Learnings:**
- Structured logger exists but was never broadly adopted
- Database migration file accounts for 76 calls (acceptable)
- Hot-path logging is the highest-impact target for migration

## Notes
