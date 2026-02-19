---
status: pending
priority: p3
issue_id: "131"
tags: [code-review, performance]
dependencies: []
---

# SQLite Prepared Statements Not Cached in SqliteManager

## Problem Statement

`SqliteManager.execute()`, `.get()`, and `.all()` call `this.db.prepare(sql)` from scratch on every invocation. For hot-path queries like log insertion, server status updates, and health metric recording, this re-compiles the SQL statement every time. `better-sqlite3` prepared statements are designed to be cached and reused for performance.

## Findings

- `apps/electron/src/main/infrastructure/database/sqlite-manager.ts` -- central database access layer
- `this.db.prepare(sql)` is called on every `execute()`, `get()`, and `all()` invocation
- `better-sqlite3` documentation recommends caching prepared statements for frequently-used queries
- Preparing a statement involves parsing SQL syntax and building a query plan -- wasted work when the SQL string is identical across calls

**Hot-path queries that would benefit from caching:**
- Log insertion (every MCP request/response)
- Server status updates
- Health metric recording
- Settings reads
- Audit log writes

**Performance context:**
- For a desktop app with moderate query volume, the impact is small per query
- Cumulative impact grows with number of active MCP servers and request volume
- `better-sqlite3` prepare is fast but not free (~0.1-0.5ms per call depending on query complexity)

## Proposed Solutions

### Option 1: Add a prepared statement cache by SQL string

**Approach:** Add a `Map<string, Statement>` to `SqliteManager`. On `execute`/`get`/`all`, check the cache first. If the SQL string is found, reuse the prepared statement. If not, prepare it and cache it. Clear the cache on database close or workspace switch.

**Pros:**
- Transparent to all callers (no API change)
- Significant speedup for repeated hot-path queries
- Simple implementation (~15 lines of cache logic)

**Cons:**
- Cache grows with unique SQL strings (bounded by number of distinct queries in codebase)
- Must clear cache when database is closed or switched
- Statements hold references to database connection

**Effort:** 1-2 hours

**Risk:** Low -- `better-sqlite3` prepared statements are safe to reuse

---

### Option 2: Cache at the repository level

**Approach:** Have each repository prepare and cache its own statements during initialization. Pass prepared statements directly to SqliteManager or call `.run()`/`.get()`/`.all()` on them directly.

**Pros:**
- Explicit ownership of cached statements per repository
- Repositories know which queries are hot-path
- No implicit global cache

**Cons:**
- Requires changes to every repository
- More code per repository
- Breaks the current SqliteManager abstraction

**Effort:** 4-6 hours

**Risk:** Medium -- touches all repositories

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `apps/electron/src/main/infrastructure/database/sqlite-manager.ts` -- central implementation
- All repository classes that use SqliteManager (indirectly benefited)

**Related components:**
- BaseRepository (uses SqliteManager methods)
- All concrete repositories
- Workspace switching (must clear statement cache)

**Database changes:** None

## Resources

- `better-sqlite3` documentation on prepared statements and performance
- SQLite prepared statement internals

## Acceptance Criteria

- [ ] Hot-path queries use cached prepared statements
- [ ] Statement cache cleared on database close/workspace switch
- [ ] No memory leaks from stale statement references
- [ ] Measurable or verifiable performance improvement for repeated queries

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Claude Code

**Actions:**
- Found `this.db.prepare(sql)` called in every SqliteManager method
- Identified sqlite-manager.ts as the sole file with `this.db.prepare` calls
- Reviewed better-sqlite3 caching recommendations
- Identified hot-path query patterns

**Learnings:**
- better-sqlite3 prepared statements are synchronous and thread-safe (single connection)
- Caching at SqliteManager level is the lowest-effort, highest-impact approach

## Notes
