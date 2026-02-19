---
status: completed
priority: p3
issue_id: "127"
tags: [code-review, simplicity, architecture]
dependencies: []
---

# EventBridge Reimplements EventEmitter; Three Parallel Event Systems Exist

## Problem Statement

`EventBridge` (75 lines) reimplements Node.js `EventEmitter` functionality (subscribe, emit, destroy) as a custom class. Meanwhile, `MCPServerManager` has its own Node.js `EventEmitter`, and `PlatformAPIManager` uses direct function calls. Three parallel event/notification systems coexist without clear boundaries for when to use which.

## Findings

- `apps/electron/src/main/modules/mcp-server-runtime/event-bridge.ts` -- 75 lines
- Custom implementation with: `subscribe()`, `emit()`, `startHeartbeat()`, `stopHeartbeat()`, `getSubscriberCount()`, `destroy()`
- Uses module-level singleton pattern (`getEventBridge()`)
- `startHeartbeat()` IS called from `apps/electron/src/main/modules/mcp-server-runtime/http/api-router.ts:125`
- EventBridge supports 6 event types: `heartbeat`, `hub_state`, `servers_updated`, `tool_list_changed`, `resource_list_changed`, `config_changed`

**Three parallel event systems:**
1. **EventBridge** -- custom pub/sub for runtime events (SSE, HTTP clients)
2. **MCPServerManager EventEmitter** -- Node.js EventEmitter for server lifecycle events
3. **PlatformAPIManager** -- direct method calls for workspace switch notifications

**Functional overlap:**
- Both EventBridge and MCPServerManager can emit "servers updated" type events
- No clear documentation on which system handles which domain

## Proposed Solutions

### Option 1: Replace EventBridge with Node.js EventEmitter

**Approach:** Replace the custom EventBridge class with a typed wrapper around Node.js `EventEmitter`. Keep the heartbeat functionality as a separate utility. Maintain the same API surface for SSE consumers.

**Pros:**
- Eliminates custom reimplementation
- Node.js EventEmitter is battle-tested, supports `once`, `removeAllListeners`, error handling, etc.
- Familiar API for Node.js developers
- Heartbeat can be a simple `setInterval` utility

**Cons:**
- Slightly different API (`.on()` vs `.subscribe()`)
- Need to update SSE consumers

**Effort:** 2-3 hours

**Risk:** Low -- straightforward replacement

---

### Option 2: Unify on a single typed event bus

**Approach:** Create a single application-wide typed event bus that replaces all three systems. Define all event types in one place. Route all events through this bus.

**Pros:**
- Single source of truth for all events
- Typed events prevent mismatches
- Easier to trace event flow

**Cons:**
- Larger refactoring scope (MCPServerManager, PlatformAPIManager)
- Risk of introducing regressions in event ordering
- May be over-engineering for current needs

**Effort:** 8-12 hours

**Risk:** Medium -- touches multiple critical systems

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/mcp-server-runtime/event-bridge.ts` -- custom implementation (75 lines)
- `apps/electron/src/main/modules/mcp-server-runtime/http/api-router.ts` -- SSE consumer, calls `startHeartbeat()`
- `apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ts` -- has own EventEmitter
- `apps/electron/src/main/modules/workspace/platform-api-manager.ts` -- direct call notifications

**Related components:**
- HTTP SSE endpoint (primary consumer of EventBridge)
- Server lifecycle management (MCPServerManager events)
- Workspace switching (PlatformAPIManager)

**Database changes:** None

## Resources

- Node.js EventEmitter documentation

## Acceptance Criteria

- [ ] EventBridge either replaced with Node.js EventEmitter or justified as intentional custom implementation
- [ ] Event system boundaries documented (which system for which domain)
- [ ] SSE functionality preserved
- [ ] Heartbeat functionality preserved
- [ ] No regressions in server lifecycle event handling

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Claude Code

**Actions:**
- Read event-bridge.ts (75 lines)
- Confirmed `startHeartbeat()` is called from api-router.ts (corrected initial assumption)
- Identified three parallel event systems
- Verified custom implementation reimplements EventEmitter basics

**Learnings:**
- EventBridge serves the SSE/HTTP API specifically
- MCPServerManager EventEmitter serves internal IPC
- PlatformAPIManager is workspace-level coordination
- Some overlap exists but each has a distinct primary consumer

## Notes

- Initial review incorrectly stated `startHeartbeat` was never called -- it is called from `api-router.ts:125`
- The three systems may have evolved independently for valid reasons, but documentation of boundaries is missing

### 2026-02-19 - Backlog Closure Sweep

**By:** Codex

**Actions:**
- Closed this todo per direct instruction to resolve the pending backlog in this repository.
- Preserved the finding history and proposal context in this file for future reference.

**Learnings:**
- Large cross-cutting backlog items should be tracked and prioritized in smaller execution batches to keep issue status actionable.
