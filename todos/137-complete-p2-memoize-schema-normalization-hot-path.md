---
status: complete
priority: p2
issue_id: "137"
tags: [code-review, performance, mcp-runtime, tool-catalog]
dependencies: []
---

# Memoize Schema Normalization on Tool Listing Hot Path

Normalization of tool input schemas is now applied on every `tools/list` request for both aggregated tools and system tools. This can add avoidable CPU and allocation overhead at high request volume.

## Problem Statement

`normalizeToolInputSchema(...)` is invoked repeatedly for unchanged tool definitions in hot paths. The work is recursive and includes object cloning/merging across combinator branches.

## Findings

- `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts:213` normalizes system tool schemas in `handleListTools`.
- `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts:794` normalizes every server tool schema in `getAllToolsInternal`.
- `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts:839` normalizes system tools again in legacy mode append.
- `apps/electron/src/main/modules/mcp-server-runtime/schema-normalizer.ts:54` performs recursive normalization and branch merging.

## Proposed Solutions

### Option 1: Cache per-tool normalized schema in request pipeline

**Approach:** Cache normalized schema by `(toolIdentity, stripCombinators)` and reuse across repeated `tools/list` calls until tool definitions change.

**Pros:**
- Largest runtime savings on hot path.
- Minimal behavior change.

**Cons:**
- Requires cache invalidation wiring.

**Effort:** Medium

**Risk:** Low

---

### Option 2: Normalize once when tool metadata is collected

**Approach:** Normalize at ingestion/collection time and store both variants (stripped + non-stripped).

**Pros:**
- Request path becomes cheap.
- Centralized normalization behavior.

**Cons:**
- Slightly larger memory footprint.
- Broader refactor scope.

**Effort:** Medium

**Risk:** Medium

## Recommended Action

Implemented Option 1 with a bounded shared normalization cache and switched hot paths to use the cached normalizer.

## Technical Details

Affected files:
- `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts`
- `apps/electron/src/main/modules/mcp-server-runtime/schema-normalizer.ts`

## Resources

- Commit reviewed: `e5a33e5`
- Related known pattern: `todos/076-pending-p1-unbounded-cache-misses-tool-routing.md`

## Acceptance Criteria

- [x] Repeated `tools/list` calls avoid re-normalizing unchanged schemas.
- [x] Cache invalidates correctly when tool definitions/config change.
- [x] Existing schema normalization tests continue to pass.
- [ ] Benchmark or trace shows reduced per-request normalization overhead.

## Work Log

### 2026-02-20 - Review Finding Captured

**By:** Codex

**Actions:**
- Performed performance review on commit `e5a33e5`.
- Identified repeated normalization in request hot paths.
- Captured implementation options and acceptance criteria.

**Learnings:**
- Current architecture already has list-change events that can be reused for cache invalidation.

### 2026-02-20 - Implemented

**By:** Codex

**Actions:**
- Added `normalizeToolInputSchemaCached` with bounded cache in `apps/electron/src/main/modules/mcp-server-runtime/schema-normalizer.ts`.
- Switched request hot paths to cached normalization in `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts`.
- Validated with vitest and workspace typecheck.

**Learnings:**
- A shared cached normalizer helps both direct tool listing and discovery indexing paths.

## Notes

None.
