---
status: complete
priority: p3
issue_id: "130"
tags: [code-review, performance]
dependencies: []
---

# BaseRepository Executes Table Existence Check on Every getAll() Call

## Problem Statement

Every `getAll()` call in `BaseRepository` executes a metadata query (`SELECT name FROM sqlite_master WHERE type='table'`) before the actual data query. Tables are created during initialization and never dropped at runtime, so this check always returns true after the first successful call. This adds an unnecessary SQLite query per read operation.

## Findings

- `apps/electron/src/main/infrastructure/database/base-repository.ts` -- contains the table existence check
- The check queries `sqlite_master` system table before every `getAll()` invocation
- Tables are defined inline in each repository class and created during `initialize()` / first access
- No code path drops or recreates tables at runtime
- The check is always true after initialization, making it pure overhead
- Also found in `apps/electron/src/main/modules/workspace/workspace.service.ts` and `apps/electron/src/main/infrastructure/database/main-database-migration.ts` (migration context is acceptable)

**Performance impact:**
- Low per individual call (SQLite metadata queries are fast)
- Cumulative impact on hot paths that call `getAll()` frequently (log retrieval, server listing, skill listing)
- Each `getAll()` executes 2 queries instead of 1

## Proposed Solutions

### Option 1: Cache the table existence result

**Approach:** After the first successful table existence check, cache the result in a boolean instance variable. Skip the metadata query on subsequent calls.

**Pros:**
- Minimal code change (add a `private tableVerified = false` field)
- Eliminates redundant metadata queries after first call
- Safe -- tables are never dropped at runtime

**Cons:**
- If a table were somehow dropped (shouldn't happen), the cache would be stale
- Very minor risk if database corruption occurs

**Effort:** 15-30 minutes

**Risk:** Low

---

### Option 2: Remove the table existence check entirely

**Approach:** Remove the `sqlite_master` query from `getAll()`. Rely on the initialization path to create tables. If a table does not exist, SQLite will return a clear error that can be caught.

**Pros:**
- Simplest solution
- No caching logic needed
- SQLite errors are descriptive ("no such table: X")

**Cons:**
- Slightly worse error message if table somehow missing
- Loses the graceful empty-result fallback

**Effort:** 15 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `apps/electron/src/main/infrastructure/database/base-repository.ts` -- main implementation
- All repository subclasses that inherit `getAll()` (10+ files)

**Related components:**
- SqliteManager (executes the actual queries)
- All repository classes extending BaseRepository

**Database changes:** None

## Resources

- SQLite `sqlite_master` documentation

## Acceptance Criteria

- [ ] Table existence check either cached or removed from hot-path `getAll()`
- [ ] No regression in repository behavior when tables exist (normal case)
- [ ] Clear error handling if table is missing (edge case)
- [ ] No performance degradation

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Claude Code

**Actions:**
- Found `SELECT name FROM sqlite_master` query in base-repository.ts
- Verified tables are never dropped at runtime
- Confirmed check executes on every `getAll()` call
- Assessed performance impact as low but unnecessary

**Learnings:**
- BaseRepository was likely designed defensively for robustness during early development
- Now that initialization is stable, the check is pure overhead

## Notes

### 2026-02-19 - Backlog Closure

**By:** Codex

**Disposition:** already-fixed

**Notes:** Verified the issue is already addressed in current main branch code; no additional patch required in this pass.
