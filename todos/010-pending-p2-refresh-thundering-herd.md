---
status: pending
priority: p2
issue_id: "010"
tags: [code-review, performance, react]
dependencies: ["006", "008"]
---

# refreshSkills() Called After Every Operation Creates Thundering Herd

## Problem Statement

In `skills-store.ts`, 9 out of 11 data operations call `refreshSkills()` after completion, which fetches ALL skills + ALL client apps. This file is currently dead code (depends on #006).

## Proposed Solutions

### Solution A: Optimistic Updates (Recommended)

Follow the `updateSkill` pattern: use the API response to patch local state.

- **Effort**: Medium
- **Risk**: Low

## Acceptance Criteria

- [ ] No operation triggers a full data refresh when the mutation response contains updated data

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-05 | Identified by Performance oracle | Only updateSkill follows the right pattern |

## Resources

- File: apps/electron/src/renderer/stores/skills-store.ts
