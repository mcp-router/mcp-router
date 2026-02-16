---
status: completed
priority: p2
issue_id: "024"
tags: [code-review, performance]
dependencies: []
---

# Workflow Lookup on Every MCP Request

## Problem Statement

Every MCP request (tools/list, tools/call, resources/*, prompts/*) triggers a dynamic import, SQLite query, and BFS graph validation in `request-handler-base.ts` to check for active workflows. This adds significant latency to every single request.

## Findings

- **File:** `apps/electron/src/main/modules/mcp-server-runtime/request-handler-base.ts` lines 34-119
- Dynamic `import("./workflow-executor.ts")` on each request
- SQLite query to fetch active workflow
- BFS graph validation of workflow nodes
- These operations happen before any actual tool/resource handling

**Identified by:** Performance Oracle (CRITICAL-1)

## Proposed Solutions

### Option A: Add short-TTL cache (Recommended)
- Cache active workflow for 5-10 seconds
- Invalidate on workflow create/update/delete/toggle
- **Effort:** Small (30 min) | **Risk:** Low -- stale for at most TTL duration

### Option B: Pre-load workflow on server start
- Load active workflow into memory, update via events
- **Effort:** Medium (1 hr) | **Risk:** Low

## Acceptance Criteria

- [ ] Workflow lookup does not hit SQLite on every request
- [ ] Cache invalidated when workflows change
- [ ] No measurable latency increase on tool calls

## Work Log

| Date | Action |
|------|--------|
| 2026-02-16 | Created from multi-agent code review |
| 2026-02-16 | Fixed by parallel resolve agents |

## Resources

- `apps/electron/src/main/modules/mcp-server-runtime/request-handler-base.ts`
