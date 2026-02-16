---
status: pending
priority: p2
issue_id: "023"
tags: [code-review, performance, react]
dependencies: []
---

# useServerFiltering God Hook Causes Re-render Cascade

## Problem Statement

The `useServerFiltering` hook subscribes to 7 Zustand stores without selectors, returns 38+ properties in a flat object, and has exactly 1 consumer (Home.tsx). Every store change triggers a full re-render of Home and all children. None of the child components use `React.memo`. The server store split (data vs UI) is effectively negated.

## Findings

- **File:** `apps/electron/src/renderer/components/useServerFiltering.ts` lines 20-46
- Subscribes to: useServerStore, useServerUIStore, useWorkspaceStore, useAuthStore, useViewPreferencesStore, useProjectStore, useServerEditingStore
- Returns 38+ values including data, local state, handlers, and store actions
- Child components (ServerGridView, ServerListView, ServerToolbar, ServerModals) have no `React.memo`
- Several handler wrappers are trivial pass-throughs adding no value

**Identified by:** TypeScript Reviewer (HIGH-5), Performance Oracle (CRITICAL-2), Simplicity Reviewer (Finding 2)

## Proposed Solutions

### Option A: Use Zustand selectors + React.memo on children (Recommended)
- Replace destructured stores with granular selectors
- Add React.memo to ServerGridView, ServerListView, ServerToolbar, ServerModals
- **Effort:** Medium (2 hrs) | **Risk:** Low

### Option B: Split into focused hooks + move store subscriptions into children
- Each child component subscribes to only the stores it needs
- **Effort:** Large (4 hrs) | **Risk:** Medium -- more scattered state management

## Acceptance Criteria

- [ ] No full-store subscriptions via destructuring
- [ ] Child components wrapped in React.memo where appropriate
- [ ] Store changes that only affect one section don't re-render others

## Work Log

| Date | Action |
|------|--------|
| 2026-02-16 | Created from multi-agent code review |

## Resources

- `apps/electron/src/renderer/components/useServerFiltering.ts`
- `apps/electron/src/renderer/components/Home.tsx`
