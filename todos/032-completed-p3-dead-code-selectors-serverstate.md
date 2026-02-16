---
status: completed
priority: p3
issue_id: "032"
tags: [code-review, cleanup]
dependencies: []
---

# Dead Code: createServerSelectors and ServerState Type

## Problem Statement

Two pieces of dead code exist after the server store split:
1. `createServerSelectors` function in server-store.ts (lines 278-291) -- defined but never exported or used
2. `ServerState` deprecated type alias in `packages/shared/src/types/ui/index.ts` (lines 50-51) -- zero imports

## Findings

- **File:** `apps/electron/src/renderer/stores/server-store.ts` lines 278-291
- **File:** `packages/shared/src/types/ui/index.ts` lines 50-51
- Also: `_projectId` unused parameter in `request-handlers.ts` `isToolCatalogEnabled()`

**Identified by:** Simplicity Reviewer (Findings 5, 6, 8), TypeScript Reviewer (HIGH-9)

## Proposed Solutions

Remove all three items. **Effort:** Small (5 min) | **Risk:** None

## Acceptance Criteria

- [ ] `createServerSelectors` removed
- [ ] `ServerState` type alias removed
- [ ] `_projectId` parameter removed from `isToolCatalogEnabled`

## Work Log

| Date | Action |
|------|--------|
| 2026-02-16 | Created from multi-agent code review |
| 2026-02-16 | Fixed by parallel resolve agents |
