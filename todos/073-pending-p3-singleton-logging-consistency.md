---
status: pending
priority: p3
issue_id: "073"
tags: [code-review, architecture, quality]
dependencies: []
---

# Singleton Pattern and Logging Consistency

## Problem Statement

New code uses two different singleton patterns and `console.log` in production code instead of the project's structured logging utilities.

## Findings

**TypeScript Reviewer + Architecture Strategist:**

1. **Inconsistent singleton patterns**: Some use static class (`getInstance()`/`resetInstance()`), others use module-level `let instance` with exported functions. Both work but the inconsistency makes it harder to audit which singletons need workspace-switch resets.

2. **console.log in production** (aggregator-server.ts:84-93,269,307): Session management uses `console.log` while the rest of the codebase uses `safeConsoleLog` or structured logging.

3. **Missing `resetSamplingProxy` export**: Every other module-level singleton has a reset function.

4. **`ServerDiscoveryService` has no singleton pattern**: Unlike every other service in the codebase.

5. **`TaskRegistry.cleanupTimer.unref()` called directly** without defensive check used in other files (rate-limiter.ts, aggregator-server.ts).

## Proposed Solutions

### Option A: Standardize patterns (Recommended)
1. Replace `console.log` with `safeConsoleLog` in aggregator-server.ts
2. Add `resetSamplingProxy()` export
3. Standardize `unref()` defensive checks across all files
- **Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] No raw `console.log` in new production code
- [ ] All singletons have reset functions
- [ ] Consistent timer `unref()` pattern

## Work Log

| Date | Action |
|------|--------|
| 2026-02-17 | Created from multi-agent code review |
