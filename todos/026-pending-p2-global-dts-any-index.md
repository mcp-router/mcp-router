---
status: pending
priority: p2
issue_id: "026"
tags: [code-review, typescript]
dependencies: []
---

# global.d.ts Index Signature Defeats Type Checking

## Problem Statement

The `electronAPI` interface in `global.d.ts` has `[key: string]: any` index signature, which means TypeScript accepts any property access without error -- even completely fabricated method names. This silently defeats type checking across the entire preload boundary, the most critical API surface in the Electron app.

## Findings

- **File:** `apps/electron/src/global.d.ts` line 94
- Any `window.electronAPI.nonExistentMethod()` call compiles without error
- The preload boundary should be the most strictly typed surface in the app

**Identified by:** TypeScript Reviewer (HIGH-8)

## Proposed Solutions

### Option A: Remove index signature, add missing declarations (Recommended)
- Remove `[key: string]: any`
- Audit `preload.ts` and add explicit type declarations for all methods
- **Effort:** Medium (1 hr) | **Risk:** Low -- may surface existing type errors

## Acceptance Criteria

- [ ] No index signature on electronAPI interface
- [ ] All methods from preload.ts have explicit typed declarations
- [ ] TypeScript catches invalid method calls on electronAPI

## Work Log

| Date | Action |
|------|--------|
| 2026-02-16 | Created from multi-agent code review |

## Resources

- `apps/electron/src/global.d.ts`
- `apps/electron/src/preload.ts`
