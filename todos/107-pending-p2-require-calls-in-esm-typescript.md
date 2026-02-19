---
status: pending
priority: p2
issue_id: "107"
tags: [code-review, typescript]
dependencies: []
---

# require() Calls in ESM TypeScript Bypass Type Checking

Three `require()` calls in `system-server.ts` bypass TypeScript type checking, return `any`, and can fail at runtime in ESM-only environments.

## Problem Statement

`system-server.ts` uses CommonJS `require()` in three locations instead of proper ES module `import` statements. These calls:
1. Return `any`, bypassing all TypeScript type checking on the imported modules.
2. Will fail at runtime if the project ever migrates to ESM-only (`"type": "module"`).
3. Are inconsistent with the rest of the codebase which uses static imports.

## Findings

- Line 1031: `const { getAuditLogService } = require("../mcp-logger/audit-log.service");` -- dynamic require of a local module, returns `any`.
- Line 1051: `const os = require("os");` -- dynamic require of Node.js built-in, returns `any`.
- Line 1074: `const fs = require("fs");` -- dynamic require of Node.js built-in, returns `any`.

All three modules are available as standard ES module imports and have proper TypeScript typings. The `require()` usage appears to be lazy imports to avoid circular dependencies or reduce startup time, but the type safety cost is not justified.

**Location:**
- `apps/electron/src/main/modules/system-server/system-server.ts` lines 1031, 1051, 1074

## Proposed Solutions

### Option 1: Replace with static imports at file top

**Approach:** Move all three imports to the top of the file as standard `import` statements.

**Pros:**
- Full TypeScript type checking on all imported symbols
- Consistent with codebase conventions
- ESM-compatible
- Simplest change

**Cons:**
- If `require()` was used to break circular dependencies, this may resurface that issue
- Slightly increases module initialization cost (all imports resolved at load time)

**Effort:** 30 minutes

**Risk:** Low (need to verify no circular dependency)

---

### Option 2: Replace with dynamic `import()` expressions

**Approach:** Use `const os = await import("os")` for lazy loading while maintaining ESM compatibility and type safety.

**Pros:**
- Preserves lazy-loading behavior
- Full TypeScript type checking
- ESM-compatible
- Handles circular dependency case if it exists

**Cons:**
- Requires the containing functions to be `async` (they may already be)
- Slightly more verbose than static imports

**Effort:** 1 hour

**Risk:** Low

---

### Option 3: Static imports for builtins, dynamic import for local module

**Approach:** Use static `import os from "os"` and `import fs from "fs"` at file top (no reason to lazy-load Node builtins), but use `await import()` for the audit-log service in case of circular dependency.

**Pros:**
- Best of both approaches
- Node builtins are always available, no reason to defer
- Audit-log import gets type safety while remaining lazy

**Cons:**
- Mixed import strategies in one file (minor)

**Effort:** 30 minutes

**Risk:** Low

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/system-server/system-server.ts` lines 1031, 1051, 1074

**Related components:**
- `apps/electron/src/main/modules/mcp-logger/audit-log.service.ts` (local import)
- Node.js `os` and `fs` built-in modules

## Acceptance Criteria

- [ ] All three `require()` calls replaced with typed imports
- [ ] `pnpm typecheck` passes with no new errors
- [ ] No `any` types introduced by the import replacements
- [ ] Electron app starts and system-server functionality works (OS info, file reads, audit logging)
- [ ] No circular dependency errors at runtime

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Code Review

**Actions:**
- Identified 3 `require()` calls in system-server.ts
- Confirmed all modules have proper TypeScript type definitions
- Verified `os` and `fs` are used as standard Node.js builtins
- Confirmed audit-log.service has proper exports

**Learnings:**
- The `require()` pattern appears to be a legacy habit rather than intentional lazy loading
- All three modules are small and fast to load

## Resources
