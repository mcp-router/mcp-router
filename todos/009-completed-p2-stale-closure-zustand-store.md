---
status: completed
priority: p2
issue_id: "009"
tags: [code-review, bug, zustand, react]
dependencies: ["006"]
---

# Stale Closure Risk in Zustand Store Operations

## Problem Statement

In `skills-store.ts`, `updateSkill` and `deleteSkill` destructure `skills` from `get()` at the start of the async operation. After the async API call, the captured `skills` array may be stale. This file is currently dead code (depends on #006).

## Proposed Solutions

### Solution A: Use set() with Updater Function (Recommended)

```typescript
set((state) => ({
  skills: state.skills.map((skill) => (skill.id === id ? updatedSkill : skill)),
}));
```

- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] No operation captures `skills` array before an async boundary
- [ ] All state updates use `set()` with updater function

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-05 | Identified by TypeScript reviewer | Classic Zustand stale closure pattern |

## Resources

- File: apps/electron/src/renderer/stores/skills-store.ts:202, 230
