---
status: complete
priority: p3
issue_id: "139"
tags: [code-review, simplicity, maintainability, mcp-runtime]
dependencies: []
---

# Deduplicate System Tool Schema Normalization Logic

The same normalization block for system tools appears in multiple places, increasing maintenance risk.

## Problem Statement

System tool input schema normalization is repeated in both catalog-mode and legacy-mode code paths. Future behavior changes can drift between paths.

## Findings

- `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts:223` normalizes system tool schemas for `handleListTools`.
- `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts:839` repeats similar normalization while appending system tools in `getAllToolsInternal`.
- Logic duplication increases chance of inconsistent behavior if one path changes.

## Proposed Solutions

### Option 1: Shared helper for system tool normalization

**Approach:** Extract one helper to normalize and annotate system tool definitions and reuse in both call sites.

**Pros:**
- Single source of truth.
- Easier updates and tests.

**Cons:**
- Minor refactor touchpoints.

**Effort:** Small

**Risk:** Low

---

### Option 2: Funnel all system tool assembly through one path

**Approach:** Centralize system-tool construction in one method and call from both catalog and legacy flows.

**Pros:**
- Removes duplication entirely.
- Clear ownership.

**Cons:**
- Slightly broader method restructuring.

**Effort:** Small

**Risk:** Low

## Recommended Action

Implemented Option 1 by extracting a shared helper that normalizes and annotates system tools for both catalog and legacy flows.

## Technical Details

Affected file:
- `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts`

## Resources

- Commit reviewed: `e5a33e5`

## Acceptance Criteria

- [x] System tool schema normalization logic exists in one shared path.
- [x] Both catalog and legacy responses use the same helper/path.
- [x] Existing tests still pass.

## Work Log

### 2026-02-20 - Review Finding Captured

**By:** Codex

**Actions:**
- Compared catalog-mode and legacy-mode system tool inclusion paths.
- Identified duplicate normalization logic blocks.
- Added simplification plan with low-risk refactor options.

**Learnings:**
- Duplication here directly impacts consistency for client-specific schema handling.

### 2026-02-20 - Implemented

**By:** Codex

**Actions:**
- Added `getNormalizedSystemTools(...)` helper in `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts`.
- Reused helper in both `handleListTools(...)` and `getAllToolsInternal(...)`.
- Confirmed tests and typecheck pass after refactor.

**Learnings:**
- Centralizing system tool shaping reduces drift risk as schema compatibility rules evolve.

## Notes

None.
