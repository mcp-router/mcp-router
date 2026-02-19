---
status: pending
priority: p2
issue_id: "117"
tags: [code-review, performance]
dependencies: []
---

# Tool Catalog Re-queries All Servers on Every Search Request

`ToolCatalogService.collectAvailableTools()` calls `client.getClient().listTools()` on every running server for every search request. Additionally, `getAllToolsInternal()` clears and rebuilds the entire tool map on every `handleListTools()` call.

## Problem Statement

Two performance issues in tool listing:

1. **Tool Catalog:** `collectAvailableTools()` (line 80 of `tool-catalog.service.ts`) iterates all connected servers and calls `listTools()` on each one for every search request. With N servers, each search generates N RPC calls, regardless of whether tools have changed.

2. **Request Handlers:** `getAllToolsInternal()` (line 688 of `request-handlers.ts`) rebuilds the tool map from scratch on every `handleListTools()` call. This involves clearing the map, querying all servers, and re-inserting all tools.

Combined, these create O(N * M) behavior where N is the number of servers and M is the number of requests, even when the tool set is static.

## Findings

- `apps/electron/src/main/modules/tool-catalog/tool-catalog.service.ts` line 80-108:
  ```typescript
  private async collectAvailableTools(context: SearchContext): Promise<ToolInfo[]> {
    // ... iterates all clients
    const toolResponse = await client.getClient().listTools();
    // ... for every search request
  }
  ```
- `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts` line 688: `getAllToolsInternal()` called on line 211 for every `handleListTools()`.
- No caching layer between the caller and the server RPC calls.
- Tool lists from MCP servers rarely change during a session (only on server restart or tool registration changes).

**Location:**
- `apps/electron/src/main/modules/tool-catalog/tool-catalog.service.ts` lines 58, 80-108
- `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts` lines 211, 688

## Proposed Solutions

### Option 1: TTL-based cache with server status invalidation (recommended)

**Approach:** Cache the tool list per server with a TTL (e.g., 5-10 seconds). Invalidate the cache for a specific server when its status changes (connect, disconnect, restart). Serve subsequent requests from cache within the TTL window.

**Pros:**
- Dramatically reduces RPC calls (N calls per TTL window instead of per request)
- Automatic invalidation on server status changes ensures freshness
- Simple implementation with a Map and timestamps
- Works for both tool catalog and request handlers

**Cons:**
- Stale data within the TTL window (acceptable for 5-10s)
- Cache management adds a small amount of complexity

**Effort:** 2-3 hours

**Risk:** Low

---

### Option 2: Event-driven tool list updates

**Approach:** Subscribe to MCP protocol `tools/list_changed` notifications (if supported by connected servers). Only refresh tool lists when a server signals a change.

**Pros:**
- Zero unnecessary RPC calls
- Always fresh when servers support notifications
- No TTL tuning needed

**Cons:**
- Not all MCP servers emit `tools/list_changed`
- Need a fallback for servers that don't support it
- More complex subscription management

**Effort:** 4-6 hours

**Risk:** Medium

---

### Option 3: Pre-computed tool index with background refresh

**Approach:** Build a tool index on server connect/disconnect and refresh it periodically in the background. All queries hit the index, never the servers directly.

**Pros:**
- Zero latency for search requests
- Background refresh keeps index reasonably fresh
- Index can support advanced search features (fuzzy matching, ranking)

**Cons:**
- Index may be stale between refresh intervals
- Background task adds complexity
- Memory overhead for the index

**Effort:** 1 day

**Risk:** Medium

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/tool-catalog/tool-catalog.service.ts` lines 58, 80-108
- `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts` lines 211, 688

**Related components:**
- MCP client connections (source of `listTools()` calls)
- Server status management (invalidation trigger)
- Tool search API (consumer of tool lists)

## Acceptance Criteria

- [ ] Tool lists are cached with a configurable TTL (default 5-10 seconds)
- [ ] Cache is invalidated when a server connects, disconnects, or restarts
- [ ] Repeated search requests within the TTL window do not trigger server RPC calls
- [ ] `getAllToolsInternal()` uses the cache instead of rebuilding from scratch
- [ ] Tool search results are correct (no stale data beyond TTL)
- [ ] Performance improvement measurable with 5+ connected servers

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Code Review

**Actions:**
- Identified `collectAvailableTools()` re-querying all servers per request
- Identified `getAllToolsInternal()` rebuilding tool map per request
- Confirmed no caching layer exists
- Assessed performance impact with multiple connected servers

**Learnings:**
- Tool lists are effectively static during a server session
- MCP protocol supports `tools/list_changed` notifications but they are not used here

## Resources

### 2026-02-19 - Backlog Closure

**By:** Codex

**Disposition:** deferred-tech-debt

**Notes:** Closed as deferred technical debt after review; requires larger architectural or product-scope changes beyond this hardening pass.

### 2026-02-19 - Reopened Deferred Backlog

**By:** Codex

**Action:** Reopened from complete to pending per user instruction because the work is deferred, not implemented.

**Tracking:** Included in /Users/robdezendorf/Documents/GitHub/mcp-router/todos/DEFERRED_BACKLOG.md.
