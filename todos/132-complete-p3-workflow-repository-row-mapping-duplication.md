---
status: complete
priority: p3
issue_id: "132"
tags: [code-review, duplication]
dependencies: []
---

# Workflow and Hook Repositories Duplicate Row-to-Entity Mapping

## Problem Statement

`WorkflowRepository` has an identical row-to-entity mapping block repeated 4 times across `getAllWorkflows`, `getEnabledWorkflows`, `getWorkflowById`, and `getWorkflowsByType`. `HookRepository` has 3 similar repetitions. This is exactly the problem that `BaseRepository`'s `mapRowToEntity` pattern was designed to solve, but these repositories do not use it.

## Findings

**WorkflowRepository (4 repetitions):**
- `apps/electron/src/main/modules/workflow/workflow.repository.ts`
  - `getAllWorkflows()` (line ~75) -- maps row to `WorkflowDefinition`
  - `getEnabledWorkflows()` (line ~100) -- identical mapping
  - `getWorkflowById()` (line ~126) -- identical mapping
  - `getWorkflowsByType()` (line ~158) -- identical mapping
- Each repetition includes JSON.parse of `config`, `trigger`, `conditions`, `actions` fields
- Each is approximately 15-20 lines of mapping logic

**HookRepository (3 repetitions):**
- `apps/electron/src/main/modules/workflow/hook.repository.ts`
- Similar pattern: multiple query methods each with identical row-to-entity mapping

**BaseRepository pattern:**
- `apps/electron/src/main/infrastructure/database/base-repository.ts` provides `mapRowToEntity` as an overridable method
- WorkflowRepository and HookRepository extend BaseRepository but do not use this pattern for their custom query methods

## Proposed Solutions

### Option 1: Extract a private mapRowToEntity helper method

**Approach:** In each repository, extract the repeated mapping block into a private `mapRowToWorkflow()` or `mapRowToHook()` method. Call this method from each query method.

**Pros:**
- Simple, localized change
- Single definition of the mapping logic per repository
- Easy to test the mapping in isolation
- Minimal risk

**Cons:**
- Does not leverage BaseRepository's built-in pattern
- Each repository still has its own mapping method

**Effort:** 30-45 minutes

**Risk:** Low

---

### Option 2: Migrate to BaseRepository mapRowToEntity pattern

**Approach:** Override `mapRowToEntity()` in WorkflowRepository and HookRepository. Use BaseRepository's `getAll()`, `getById()` etc. where possible, removing custom query methods that differ only in WHERE clause.

**Pros:**
- Leverages existing infrastructure
- Consistent with other repositories
- May eliminate some custom query methods entirely

**Cons:**
- BaseRepository may not support all the custom WHERE clauses (e.g., `getWorkflowsByType`, `getEnabledWorkflows`)
- Requires understanding BaseRepository API surface
- More involved refactoring

**Effort:** 2-3 hours

**Risk:** Low-Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/workflow/workflow.repository.ts` -- 4 duplicated mapping blocks
- `apps/electron/src/main/modules/workflow/hook.repository.ts` -- 3 duplicated mapping blocks
- `apps/electron/src/main/infrastructure/database/base-repository.ts` -- provides the pattern

**Related components:**
- WorkflowService (calls repository methods)
- HookService (calls repository methods)
- Workflow IPC handlers

**Database changes:** None

## Resources

- BaseRepository pattern in `apps/electron/src/main/infrastructure/database/base-repository.ts`

## Acceptance Criteria

- [ ] Row-to-entity mapping defined once per repository (not repeated per query method)
- [ ] All query methods produce identical output to current implementation
- [ ] JSON.parse of config/trigger/conditions/actions handled in single location
- [ ] No regressions in workflow or hook CRUD operations

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Claude Code

**Actions:**
- Identified 4 duplicate mapping blocks in WorkflowRepository
- Identified 3 duplicate mapping blocks in HookRepository
- Verified BaseRepository provides mapRowToEntity pattern
- Confirmed repositories extend BaseRepository but don't use mapRowToEntity for custom methods

**Learnings:**
- Duplication likely arose from adding query methods incrementally without refactoring
- JSON.parse of multiple columns makes each mapping block ~15-20 lines

## Notes

### 2026-02-19 - Backlog Closure

**By:** Codex

**Disposition:** already-fixed

**Notes:** Verified the issue is already addressed in current main branch code; no additional patch required in this pass.
