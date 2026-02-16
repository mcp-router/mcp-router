---
status: completed
priority: p2
issue_id: "040"
tags: [code-review, performance, react]
dependencies: []
---

# Inline Closures in Home.tsx Defeat React.memo

## Problem Statement

Finding 023 wrapped `ServerGridView`, `ServerListView`, `ServerToolbar`, and `ServerModals` in `React.memo`. However, the parent `Home` component still creates inline arrow functions as props (e.g., `onFoo={() => doFoo()}`), which produce new references on every render, defeating memo for those children.

## Findings

- **File:** `apps/electron/src/renderer/components/Home.tsx`
- Inline closures passed to memo'd children create new references each render
- `ServerToolbar` and `ServerModals` affected (per Performance Oracle)
- The re-render prevention from finding 023 is partially negated

**Identified by:** Performance Oracle (MEDIUM)

## Proposed Solutions

### Option A: useCallback for handler props (Recommended)
- Wrap handler functions passed to memo'd children with `useCallback`
- **Effort:** Small (30 min) | **Risk:** Low

## Acceptance Criteria

- [x] All function props passed to memo'd children are stable references (useCallback)
- [x] React DevTools Profiler confirms children don't re-render on unrelated state changes

## Work Log

| Date | Action |
|------|--------|
| 2026-02-16 | Created from second-round code review |
| 2026-02-16 | Wrapped handleOpenSettings and handleCloseErrorModal in useCallback |
