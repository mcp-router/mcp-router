---
status: complete
priority: p2
issue_id: "138"
tags: [code-review, performance, correctness, tool-catalog]
dependencies: []
---

# Invalidate Tool Catalog Cache on listChanged Events

Tool list/resource list change notifications are now broadcast promptly, but catalog reads can still serve stale cache entries until TTL expiry.

## Problem Statement

`ToolCatalogService` uses a TTL cache for collected tools, while runtime now emits immediate list-changed notifications. Without event-driven invalidation, clients can re-fetch and still receive stale results.

## Findings

- `apps/electron/src/main/modules/mcp-server-runtime/aggregator-server.ts:70` subscribes to runtime events and broadcasts list-changed notifications.
- `apps/electron/src/main/modules/tool-catalog/tool-catalog.service.ts:109` returns cached tools by hash and TTL.
- No cache invalidation hook is triggered when `tool_list_changed`, `resource_list_changed`, or config updates are emitted.

## Proposed Solutions

### Option 1: Event-driven cache invalidation

**Approach:** Subscribe `ToolCatalogService` (or owning runtime component) to event bridge and clear relevant cache entries on `tool_list_changed` / `servers_updated` / config changes.

**Pros:**
- Keeps behavior aligned with listChanged semantics.
- Fresh results immediately after change.

**Cons:**
- Requires careful scope to avoid excessive invalidations.

**Effort:** Small

**Risk:** Low

---

### Option 2: Versioned cache key + change counter

**Approach:** Add a monotonic version token incremented on list/config events and include it in cache key.

**Pros:**
- Precise invalidation by key mismatch.
- Good observability.

**Cons:**
- Slightly more plumbing than direct clear.

**Effort:** Medium

**Risk:** Low

## Recommended Action

Implemented Option 1 by subscribing `ToolCatalogService` to runtime events and clearing cache on tool/server/config updates.

## Technical Details

Affected files:
- `apps/electron/src/main/modules/mcp-server-runtime/aggregator-server.ts`
- `apps/electron/src/main/modules/tool-catalog/tool-catalog.service.ts`

## Resources

- Commit reviewed: `e5a33e5`
- Related known pattern: `todos/079-pending-p1-broken-reactive-parity-list-changed.md`

## Acceptance Criteria

- [x] Cache invalidates or bypasses immediately on tool/resource/config update events.
- [x] Post-change catalog request returns fresh tool metadata without waiting for TTL.
- [x] Unit tests cover event-triggered invalidation behavior.

## Work Log

### 2026-02-20 - Review Finding Captured

**By:** Codex

**Actions:**
- Reviewed new event-bridge broadcast flow and tool catalog cache.
- Identified stale-cache window after listChanged notifications.
- Documented remediation options.

**Learnings:**
- Real-time signaling without cache invalidation can create apparent parity bugs.

### 2026-02-20 - Implemented

**By:** Codex

**Actions:**
- Added event-bridge subscription, `clearCache()`, and `dispose()` lifecycle methods in `apps/electron/src/main/modules/tool-catalog/tool-catalog.service.ts`.
- Added tests for cache reuse and event-driven invalidation in `apps/electron/src/main/modules/tool-catalog/__tests__/tool-catalog-schema-normalization.test.ts`.
- Validated with targeted vitest suite and workspace typecheck.

**Learnings:**
- Event-driven invalidation keeps reactive list-changed behavior aligned with actual fetch freshness.

## Notes

None.
