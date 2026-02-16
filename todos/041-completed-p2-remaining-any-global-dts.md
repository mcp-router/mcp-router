---
status: completed
priority: p2
issue_id: "041"
tags: [code-review, typescript]
dependencies: []
---

# Remaining `any` Types in global.d.ts

## Problem Statement

Finding 026 removed the `[key: string]: any` index signature from `ElectronAPI` in `global.d.ts` and added 17 missing typed declarations. However, approximately 15 individual method signatures still use `any` in their parameter or return types, partially undermining the type safety improvement.

## Findings

- **File:** `apps/electron/src/global.d.ts`
- ~15 method signatures still contain `any` (e.g., `Promise<any>`, `(...args: any[])`)
- These allow unsafe usage patterns that the index signature removal was meant to prevent

**Identified by:** TypeScript Reviewer (HIGH)

## Proposed Solutions

### Option A: Type all remaining methods with proper types (Recommended)
- Replace each `any` with the appropriate domain type from `@mcp_router/shared/types`
- Cross-reference with the actual IPC handler return types
- **Effort:** Medium (1-2 hr) | **Risk:** Low

## Acceptance Criteria

- [x] Zero `any` types in global.d.ts
- [x] All method signatures match their IPC handler return types

## Work Log

| Date | Action |
|------|--------|
| 2026-02-16 | Created from second-round code review |
| 2026-02-16 | Replaced all 15 remaining any types with proper domain types; fixed electron-platform-api.ts adapter mismatches |
