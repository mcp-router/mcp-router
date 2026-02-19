---
status: pending
priority: p3
issue_id: "124"
tags: [code-review, simplicity, yagni]
dependencies: []
---

# Token Budget Tracker Provides Limited Value with Rough Heuristics

## Problem Statement

`TokenBudgetTracker` (240 lines) plus `TokenEstimator` (~76 lines) total ~316 lines of infrastructure that estimates token counts using a rough `chars / 4` heuristic. The "Tool Catalog Savings" calculation is marketing-grade data (approximate cost avoidance), not operational telemetry. The effort to maintain this code exceeds the value of the approximate numbers it produces.

## Findings

- `apps/electron/src/main/modules/mcp-server-runtime/token-budget-tracker.ts` -- 240 lines
- Token estimation uses `Math.ceil(text.length / 4)` -- a rough heuristic that can be off by 2-3x depending on content
- "Tool Catalog Savings" tracks how many tokens were saved by not sending full tool catalogs, but the baseline is also estimated
- TokenBudgetTracker has a hybrid singleton pattern (both `static getInstance()` and exported `getTokenBudgetTracker()`)
- Uses `.reset()` instead of `.resetInstance()` during workspace switch (also noted in todo #122)
- Dashboard UI (todo #060, completed) consumes this data, so removal requires UI updates

**Consumers:**
- `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts` -- records token estimates
- `apps/electron/src/main/modules/system-server/system-server.ts` -- exposes to system tools
- `apps/electron/src/main/modules/workspace/platform-api-manager.ts` -- reset on workspace switch

## Proposed Solutions

### Option 1: Remove entirely

**Approach:** Delete `TokenBudgetTracker` and `TokenEstimator`. Remove token budget references from request handlers and system server. Remove associated dashboard UI.

**Pros:**
- Eliminates 316 lines of low-value code
- No more misleading approximate metrics
- Simpler request handler hot path

**Cons:**
- Loses "savings" visibility (even if approximate)
- Requires removing or updating dashboard UI from todo #060
- Some users may find the approximate data interesting

**Effort:** 2-3 hours

**Risk:** Low -- no operational dependency on approximate token counts

---

### Option 2: Simplify to basic request counters

**Approach:** Replace with a ~50-line counter that tracks `totalRequests`, `totalToolCalls`, `catalogHits`, `catalogMisses` per server. No token estimation, no savings calculation. Just factual counts.

**Pros:**
- Provides genuinely useful operational data (request counts, cache hit rates)
- 50 lines vs 316 lines
- No misleading approximate numbers
- Dashboard can show real metrics

**Cons:**
- Loses "token savings" marketing metric
- Requires updating dashboard UI

**Effort:** 3-4 hours

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/mcp-server-runtime/token-budget-tracker.ts` -- main implementation (240 lines)
- `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts` -- records estimates
- `apps/electron/src/main/modules/system-server/system-server.ts` -- exposes data
- `apps/electron/src/main/modules/workspace/platform-api-manager.ts` -- workspace reset
- Renderer dashboard components (from todo #060)

**Related components:**
- Tool Catalog system (provides the "savings" baseline)
- Request handler pipeline

**Database changes:** None

## Resources

- **Related:** Todo #060 (completed token budget dashboard)
- **Related:** Todo #122 (singleton pattern inconsistency -- hybrid pattern)

## Acceptance Criteria

- [ ] Token tracking either removed or simplified to factual counters
- [ ] No misleading approximate metrics presented to users
- [ ] Request handler hot path simplified (no unnecessary estimation calls)
- [ ] Dashboard UI updated to reflect changes
- [ ] Workspace switch handling updated

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Claude Code

**Actions:**
- Counted 240 lines in token-budget-tracker.ts
- Identified chars/4 heuristic as the estimation basis
- Found hybrid singleton pattern (also in todo #122)
- Verified dashboard UI consumes this data

**Learnings:**
- Token estimation at chars/4 can be off significantly for non-English text, code, or JSON
- "Savings" calculation depends on two approximate numbers, compounding error

## Notes
