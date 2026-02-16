---
status: completed
priority: p1
issue_id: "037"
tags: [code-review, security, typescript]
dependencies: []
---

# SystemServer callTool() Bypasses Input Validation

## Problem Statement

The `callTool()` public method (used by the aggregator to route `router_*` calls) uses `as unknown as` casts on every handler call, completely bypassing the input validation that `registerHandlers()` provides. Unvalidated input reaches handler methods directly.

## Findings

- **File:** `apps/electron/src/main/modules/system-server/system-server.ts` lines 65-101
- `callTool()` dispatches to handlers with `args as unknown as FooInput` (no validation)
- `registerHandlers()` (lines 108-355) has full validation for every tool parameter
- The aggregator in `request-handlers.ts` calls `callTool()` for all `router_*` tools, meaning the primary code path has no validation

**Identified by:** TypeScript Reviewer (CRITICAL), Security Sentinel (CRITICAL-03)

## Proposed Solutions

### Option A: Extract shared validation functions (Recommended)
- Create a private `validateAndDispatch(name, args)` method that both `callTool()` and `registerHandlers()` delegate to
- Validation logic exists once, both entry points use it
- **Effort:** Medium (1 hr) | **Risk:** Low

### Option B: Add validation directly to callTool()
- Duplicate the validation logic from registerHandlers into callTool
- **Effort:** Small (30 min) | **Risk:** Low but creates duplication

## Acceptance Criteria

- [x] `callTool()` validates all inputs before passing to handlers
- [x] No `as unknown as` casts remain in callTool()
- [x] Validation logic is not duplicated between callTool() and registerHandlers()

## Work Log

| Date | Action |
|------|--------|
| 2026-02-16 | Created from second-round code review |
| 2026-02-16 | Extracted shared validateAndDispatch(); both callTool() and registerHandlers() delegate to it; zero casts remain |
