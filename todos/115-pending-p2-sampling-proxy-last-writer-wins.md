---
status: pending
priority: p2
issue_id: "115"
tags: [code-review, architecture, bug]
dependencies: []
---

# SamplingProxy Uses Single activeServer -- Last Writer Wins

`SamplingProxy` stores a single `activeServer` reference. Every new session overwrites the previous one, causing sampling requests from concurrent clients to route to the wrong client.

## Problem Statement

The `SamplingProxy` class maintains a single `activeServer: Server | null` field (line 25). When a new client session registers with `setActiveServer()` (line 32), it overwrites any previous value. This means:
1. With multiple concurrent clients, only the most recent client receives sampling requests.
2. Earlier clients' sampling requests silently route to the wrong client.
3. If the most recent client disconnects, `activeServer` becomes stale (not automatically cleared on disconnect).
4. This is a correctness bug in multi-client scenarios, not just a theoretical concern -- the MCP HTTP server supports up to 50 concurrent sessions.

## Findings

- `apps/electron/src/main/modules/mcp-server-runtime/sampling-proxy.ts`:
  - Line 25: `private activeServer: Server | null = null;`
  - Line 32: `this.activeServer = server;` (overwrites previous)
  - Line 43: `if (!this.activeServer)` (checks single reference)
  - Line 69: `return await this.activeServer.createMessage(params);` (routes to single server)
- No session ID association -- sampling requests cannot be correlated with the initiating client.
- No cleanup when a client disconnects -- stale `activeServer` persists.

**Location:**
- `apps/electron/src/main/modules/mcp-server-runtime/sampling-proxy.ts` lines 25, 32, 43, 69

## Proposed Solutions

### Option 1: Session-to-server mapping (recommended)

**Approach:** Replace single `activeServer` with a `Map<string, Server>` keyed by session ID. Pass session ID through the tool call chain so sampling requests route to the correct client.

**Pros:**
- Correct behavior for all concurrent clients
- Each client's sampling requests go to the right place
- Cleanup is straightforward (remove entry on disconnect)

**Cons:**
- Requires threading session ID through the tool call pipeline
- May require changes to the tool call interface

**Effort:** 4-6 hours

**Risk:** Medium (requires understanding the full call chain)

---

### Option 2: Server stack with LIFO fallback

**Approach:** Use a stack of servers instead of a single reference. Pop when a server disconnects. Sampling goes to the top of the stack.

**Pros:**
- Simple data structure change
- LIFO ordering means most recent client gets priority
- Automatic fallback when clients disconnect

**Cons:**
- Still not correct for concurrent sampling -- requests from client A may go to client B
- Only appropriate if sampling is inherently single-client

**Effort:** 1-2 hours

**Risk:** Medium (does not fully solve the multi-client routing problem)

---

### Option 3: Sampling request queue with client affinity

**Approach:** Queue sampling requests and dispatch them to the specific client that initiated the tool call chain. Use a correlation ID attached to the tool call context.

**Pros:**
- Fully correct routing
- Supports arbitrary concurrency
- Decouples sampling from connection order

**Cons:**
- Most complex solution
- Requires correlation ID infrastructure
- Queue management adds operational complexity

**Effort:** 1-2 days

**Risk:** Medium-High

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/mcp-server-runtime/sampling-proxy.ts` (primary)
- Tool call pipeline (needs session ID threading)
- Aggregator server (session management)

**Related components:**
- `SamplingProxy` class
- `Server` instances (MCP protocol servers)
- Tool call routing in `RequestHandlers`
- Session management in `AggregatorServer`

## Acceptance Criteria

- [ ] Concurrent clients each receive their own sampling requests
- [ ] Sampling requests from client A never route to client B
- [ ] Disconnected clients are cleaned up (no stale activeServer)
- [ ] Single-client scenario still works correctly
- [ ] `pnpm typecheck` passes
- [ ] Manual test: connect two clients, verify sampling routes correctly

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Code Review

**Actions:**
- Identified single `activeServer` field in SamplingProxy
- Confirmed last-writer-wins behavior on `setActiveServer()`
- Assessed impact on concurrent client scenarios
- Reviewed session management in aggregator server

**Learnings:**
- The single-server design was likely adequate for initial single-client usage
- Multi-client support (MAX_SESSIONS=50) makes this a real bug, not theoretical

## Resources
