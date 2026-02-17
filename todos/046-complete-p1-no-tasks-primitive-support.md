---
status: complete
priority: p1
issue_id: "046"
tags: [strategic, protocol, competitive-gap]
dependencies: []
---

# No Tasks Primitive Support

## Problem Statement

The MCP spec 2025-11-25 introduced the Tasks primitive for long-running asynchronous operations with progress tracking, cancellation, and state management (`working`, `input_required`, `completed`, `failed`, `cancelled`). MCP Router does not implement this, meaning:

- Large operations (database exports, batch API calls, code generation) appear to hang with no feedback
- Users cannot cancel expensive in-flight operations
- No progress reporting for multi-step workflows

The feature is documented as deferred with "HIGH -- Most valuable feature once stable" in `docs/adr/MCP_DEFERRED_FEATURES.md`. However, the Tasks spec is now published (experimental) and competitors are beginning to adopt it.

## Findings

- **Spec methods:** `tasks/get`, `tasks/result`, `tasks/list`, `tasks/cancel`
- **Applicable to:** `tools/call`, `sampling/createMessage`, `elicitation/create`
- **Competitors:** Cloud MCP platforms (Cloudflare Workers, Pipedream) naturally support long-running via their infrastructure
- **Market trend:** As MCP servers move to production workloads (not just dev tools), Tasks becomes essential
- **Router challenge:** As a proxy, must track task state for each backend server and present unified task view to clients

**Identified by:** Strategic Competitive Analysis

## Proposed Solutions

### Option A: Transparent task proxying (Recommended)
- When a backend server returns a task handle, proxy it through to the client
- Maintain task-to-server mapping for routing `tasks/get`, `tasks/cancel`, etc.
- Add a task registry in the aggregator layer
- **Effort:** Large (1-2 weeks) | **Risk:** Medium (state management complexity, spec is still experimental)

### Option B: Router-managed task orchestration
- Router manages tasks internally, converting synchronous backend calls into async tasks
- Adds timeout-based task promotion (long-running sync calls become tasks automatically)
- **Effort:** Extra Large (3-4 weeks) | **Risk:** High (complex state machine, edge cases)

## Acceptance Criteria

- [ ] Backend servers can return task handles via `tools/call`
- [ ] Clients can query task status via `tasks/get` and `tasks/list`
- [ ] Clients can cancel tasks via `tasks/cancel`
- [ ] Task state changes are reflected in the UI (progress indicators)
- [ ] Task-to-server routing is correct across multiple backend servers

## Work Log

| Date | Action |
|------|--------|
| 2026-02-17 | Created from strategic competitive analysis review |
