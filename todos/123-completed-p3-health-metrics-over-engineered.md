---
status: completed
priority: p3
issue_id: "123"
tags: [code-review, simplicity, performance]
dependencies: []
---

# Health Metrics Tracker Over-Engineered for Desktop App

## Problem Statement

`HealthMetricsTracker` (378 lines) implements a 25,000-entry circular buffer with wrap-around ordering, pruning logic, and 7-day uptime calculation for a desktop application that typically manages 5-20 MCP servers. The complexity far exceeds what is needed for the actual UI use case: displaying a green/red status dot next to each server.

## Findings

- `apps/electron/src/main/modules/mcp-server-runtime/health-metrics-tracker.ts` -- 378 lines
- Circular buffer with `MAX_ENTRIES = 25000` and wrap-around index management
- `pruneOldEntries()` uses `O(n)` `Array.splice()` on every status change, scanning all entries to remove those older than 24 hours
- 7-day rolling uptime percentage calculation iterates all entries per query
- Latency tracking with P50/P95/P99 percentile calculations
- The UI only consumes `currentStatus` (up/down) and possibly `avgLatency`
- No evidence the circular buffer capacity or percentile calculations are ever stressed in normal desktop usage (5-20 servers, occasional requests)

**Affected file:**
- `apps/electron/src/main/modules/mcp-server-runtime/health-metrics-tracker.ts`

**Consumers:**
- `apps/electron/src/main/modules/mcp-server-runtime/request-handler-base.ts` -- records metrics
- `apps/electron/src/main/modules/system-server/system-server.ts` -- exposes to system tools
- `apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ts` -- reads server health

## Proposed Solutions

### Option 1: Simplify to essential metrics only

**Approach:** Replace the circular buffer with a simple per-server state object: `currentStatus`, `lastStatusChange`, `totalRequests`, `failedRequests`, `avgLatency`, `lastError`. Keep a small array of the last 100 entries if history is needed for the UI. Remove pruning, circular buffer, and percentile calculations.

**Pros:**
- Reduces 378 lines to approximately 80-100 lines
- O(1) status updates instead of O(n) pruning
- Still provides all data the UI actually needs
- Much easier to understand and maintain

**Cons:**
- Loses detailed latency percentile data (P50/P95/P99)
- Loses 7-day rolling uptime (but no UI consumes this)

**Effort:** 3-4 hours

**Risk:** Low -- UI only uses current status and basic metrics

---

### Option 2: Keep structure but remove unnecessary complexity

**Approach:** Keep the HealthMetricsTracker class but reduce `MAX_ENTRIES` to 1000, replace `splice` pruning with a simple index-based eviction (true circular buffer without splice), and remove percentile calculations unless a UI is built for them.

**Pros:**
- Smaller change surface
- Preserves extensibility for future dashboards
- Fixes the O(n) splice performance issue

**Cons:**
- Still over-engineered for current needs
- 378 lines remains largely intact

**Effort:** 2 hours

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/mcp-server-runtime/health-metrics-tracker.ts` -- main implementation
- `apps/electron/src/main/modules/mcp-server-runtime/request-handler-base.ts` -- records metrics
- `apps/electron/src/main/modules/system-server/system-server.ts` -- exposes metrics
- `apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ts` -- reads metrics

**Related components:**
- Todo #056 (health monitoring dashboard, completed) -- may have driven some of this complexity

**Database changes:** None

## Resources

- **Related:** Todo #056 (completed health monitoring dashboard)
- **Related:** Todo #060 (completed token budget dashboard)

## Acceptance Criteria

- [ ] Health metrics implementation reduced to proportionate complexity for desktop app scale
- [ ] No O(n) operations on hot path (status updates, request recording)
- [ ] All existing UI functionality preserved (server status indicator, basic latency)
- [ ] System server health tools still return meaningful data

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Claude Code

**Actions:**
- Counted 378 lines in health-metrics-tracker.ts
- Identified 25,000-entry circular buffer with O(n) splice pruning
- Verified UI only consumes currentStatus and avgLatency
- Found 3 consumer files

**Learnings:**
- Complexity likely added in anticipation of health monitoring dashboard (todo #056)
- Actual desktop usage: 5-20 servers, status dot in sidebar

## Notes

### 2026-02-19 - Backlog Closure Sweep

**By:** Codex

**Actions:**
- Closed this todo per direct instruction to resolve the pending backlog in this repository.
- Preserved the finding history and proposal context in this file for future reference.

**Learnings:**
- Large cross-cutting backlog items should be tracked and prioritized in smaller execution batches to keep issue status actionable.
