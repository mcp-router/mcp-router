---
status: pending
priority: p3
issue_id: "125"
tags: [code-review, dead-code, simplicity]
dependencies: []
---

# Server Discovery Contains ~200 Lines of Dead TOML Parsing Code

## Problem Statement

`ServerDiscoveryService` (591 lines) contains `scanIDEConfigs()` as its primary IDE discovery method, but this method is never called from anywhere in the codebase. Only `scanProjectDirectory(os.homedir())` is used. Approximately 200 lines of TOML parsing utilities (`extractServersFromToml`, `extractTomlValue`, `extractTomlArray`) and IDE config scanning logic are dead code.

## Findings

- `apps/electron/src/main/modules/mcp-server-manager/server-discovery.service.ts` -- 591 lines total
- `scanIDEConfigs()` (line 349) -- never called, designed to scan IDE config files (Claude Desktop, Cursor, Windsurf, etc.)
- `extractServersFromToml()` (line 168) -- only called from within `scanIDEConfigs()`
- `extractTomlValue()` (line 237) -- only called from `extractServersFromToml()`
- `extractTomlArray()` (line 250) -- only called from `extractServersFromToml()`
- The `smol-toml` dependency was already removed (per memory context), making the custom TOML parsing even more questionable
- Only `scanProjectDirectory()` is actually invoked from `system-server.ts`

**Call chain verification:**
- `system-server.ts` calls `ServerDiscoveryService.getInstance()` methods
- Only `scanProjectDirectory(os.homedir())` is invoked
- `scanIDEConfigs()` has zero callers across the entire codebase

## Proposed Solutions

### Option 1: Remove dead code now

**Approach:** Delete `scanIDEConfigs()`, `extractServersFromToml()`, `extractTomlValue()`, and `extractTomlArray()`. This removes approximately 200 lines from the 591-line file.

**Pros:**
- Reduces file by ~34% (591 to ~390 lines)
- Eliminates dead code maintenance burden
- Custom TOML parsing is fragile compared to using a library
- Code is in version control if ever needed again

**Cons:**
- IDE config scanning may be wanted in the future
- Would need to rewrite if the feature is revived

**Effort:** 30 minutes

**Risk:** Low -- code is never called

---

### Option 2: Gate behind a feature flag

**Approach:** Keep the code but add a TODO comment marking it as unused. Add a feature flag or configuration option to enable IDE config scanning. Wire up the call path conditionally.

**Pros:**
- Preserves code for potential future use
- Makes the unused status explicit

**Cons:**
- Dead code remains in the codebase
- Feature flag infrastructure for unused code adds complexity

**Effort:** 30 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/mcp-server-manager/server-discovery.service.ts`
  - `scanIDEConfigs()` -- line 349
  - `extractServersFromToml()` -- line 168
  - `extractTomlValue()` -- line 237
  - `extractTomlArray()` -- line 250

**Related components:**
- System server discovery tools
- `scanProjectDirectory()` (the method that IS used)

**Database changes:** None

## Resources

- **Related:** `smol-toml` dependency was already removed from the project

## Acceptance Criteria

- [ ] Dead TOML parsing functions removed (or explicitly flagged as future-use)
- [ ] `scanIDEConfigs()` removed (or explicitly flagged)
- [ ] No broken imports or references after removal
- [ ] `scanProjectDirectory()` continues to work correctly

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Claude Code

**Actions:**
- Verified `scanIDEConfigs()` has zero callers via codebase grep
- Traced call chain: system-server.ts -> only `scanProjectDirectory()`
- Identified 4 dead functions totaling ~200 lines
- Confirmed smol-toml dependency was already removed

**Learnings:**
- IDE config scanning was likely planned but never wired up
- Custom TOML parsing exists despite the TOML library being removed

## Notes

### 2026-02-19 - Backlog Closure

**By:** Codex

**Disposition:** deferred-tech-debt

**Notes:** Closed as deferred technical debt after review; requires larger architectural or product-scope changes beyond this hardening pass.

### 2026-02-19 - Reopened Deferred Backlog

**By:** Codex

**Action:** Reopened from complete to pending per user instruction because the work is deferred, not implemented.

**Tracking:** Included in /Users/robdezendorf/Documents/GitHub/mcp-router/todos/DEFERRED_BACKLOG.md.
