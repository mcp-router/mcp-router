---
status: completed
priority: p3
issue_id: "033"
tags: [code-review, typescript]
dependencies: []
---

# ServerModals and ServerListView `any` Types

## Problem Statement

`ServerModals.tsx` uses `config: any` in props and `updatedConfig: any` in handlers. `ServerListView.tsx` uses `(server as any).description` double-cast. `ServerToolbar.tsx` has `serverViewMode: string` when it should be `"list" | "grid"`.

## Findings

- **File:** `apps/electron/src/renderer/components/ServerModals.tsx` lines 43-44, 138, 150
- **File:** `apps/electron/src/renderer/components/ServerListView.tsx` lines 193-198
- **File:** `apps/electron/src/renderer/components/ServerToolbar.tsx` line 24

**Identified by:** TypeScript Reviewer (CRITICAL-2, CRITICAL-3, MEDIUM-13)

## Proposed Solutions

Use proper types from `@mcp_router/shared`. **Effort:** Small (30 min) | **Risk:** None

## Acceptance Criteria

- [ ] No `any` in ServerModals props or handlers
- [ ] `description` properly typed or guarded on MCPServer type
- [ ] `serverViewMode` typed as `"list" | "grid"`

## Work Log

| Date | Action |
|------|--------|
| 2026-02-16 | Created from multi-agent code review |
| 2026-02-16 | Fixed by parallel resolve agents |
