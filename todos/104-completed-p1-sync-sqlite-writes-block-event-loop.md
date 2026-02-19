---
status: completed
priority: p1
issue_id: "104"
tags: [code-review, performance, database]
dependencies: []
---

# Synchronous SQLite Writes Block Event Loop on Every Request

`better-sqlite3` is synchronous by design. `recordMcpRequestLog()` is called on every tool call via `executeWithHooksAndLogging`, performing a synchronous `INSERT INTO requestLogs` on the main thread. With 10+ concurrent server connections making frequent tool calls, every request blocks the Electron main thread for 0.5-50ms, causing UI jank and degraded responsiveness.

## Problem Statement

The request logging pipeline works as follows:
1. `RequestHandlerBase.executeWithHooksAndLogging()` (line 215) wraps every request handler
2. On success (line 222) and error (line 240), it calls `getLogService().recordMcpRequestLog()`
3. `MCPLoggerService.recordMcpRequestLog()` (lines 88-136) processes the log entry and calls `this.addRequestLog()`
4. `addRequestLog()` executes a synchronous SQLite `INSERT` via `better-sqlite3`

`better-sqlite3`'s `db.prepare(sql).run(params)` (sqlite-manager.ts line 75) is a blocking call that holds the event loop until the disk I/O completes. On HDD or under disk pressure, individual writes can take 5-50ms. Since this runs on the Electron main thread, it blocks:
- IPC message processing
- UI rendering updates
- Other MCP request handling

With 10 concurrent servers each making 5 tool calls per second, that is 50 synchronous writes per second on the main thread.

## Findings

**Synchronous execute in SqliteManager (lines 73-79):**
```typescript
public execute(sql: string, params: any = {}): RunResult {
  try {
    return this.db.prepare(sql).run(params);
  } catch (error) {
    console.error("Failed to execute SQL query:", error);
    throw error;
  }
}
```

**Logging on every request (request-handler-base.ts lines 215-253):**
```typescript
try {
  const result = await handler();
  logEntry.response = result;
  logEntry.duration = Date.now() - new Date(logEntry.timestamp).getTime();
  getLogService().recordMcpRequestLog(logEntry, serverName);  // sync write
  // ...
  return result;
} catch (error: unknown) {
  // ...
  getLogService().recordMcpRequestLog(logEntry, serverName);  // sync write
  throw error;
}
```

**recordMcpRequestLog in MCPLoggerService (lines 88-136):**
The method processes the log entry (strips tokens, resolves server IDs) and then calls `this.addRequestLog()` which performs the synchronous INSERT.

**Locations:**
- `apps/electron/src/main/infrastructure/database/sqlite-manager.ts` lines 73-79
- `apps/electron/src/main/modules/mcp-logger/mcp-logger.service.ts` lines 88-136
- `apps/electron/src/main/modules/mcp-server-runtime/request-handler-base.ts` lines 215-253

## Proposed Solutions

### Option 1: Write batching with periodic flush

**Approach:** Buffer log entries in an in-memory array. Flush to SQLite in a single transaction every 500ms or when the buffer reaches 50 entries, whichever comes first. Use `better-sqlite3`'s transaction API to batch all INSERTs into one disk write.

**Pros:**
- Dramatic performance improvement (50 individual writes become 1 batched transaction)
- `better-sqlite3` transactions are extremely fast (thousands of INSERTs per transaction)
- Minimal code change -- only the logger service needs modification
- No architectural changes needed

**Cons:**
- Up to 500ms of log entries could be lost on crash
- Slightly more complex shutdown logic (flush before exit)
- Memory usage increases proportionally to buffer size

**Effort:** 2-4 hours

**Risk:** Low

---

### Option 2: Offload writes to a worker thread

**Approach:** Move SQLite write operations to a Node.js `worker_threads` Worker. The main thread sends log entries to the worker via `postMessage()`. The worker owns a separate `better-sqlite3` connection and performs writes without blocking the main thread.

**Pros:**
- Main thread is never blocked by any SQLite write
- Can handle arbitrary write volume without affecting UI
- Worker can implement its own batching for additional performance

**Cons:**
- Significant architectural change
- `better-sqlite3` instances cannot be shared across threads (need separate connection)
- Message serialization overhead for each log entry
- More complex error handling and shutdown coordination

**Effort:** 8-16 hours

**Risk:** Medium

---

### Option 3: Async logging with setImmediate deferral

**Approach:** Wrap the `recordMcpRequestLog` call in `setImmediate()` so the synchronous write happens after the current event loop tick completes. This allows the request response to be sent before the log write blocks.

**Pros:**
- Trivial code change (one line)
- Request latency is no longer affected by log writes
- No batching complexity

**Cons:**
- Still blocks the event loop -- just deferred by one tick
- Does not reduce total write volume or I/O load
- UI jank is reduced but not eliminated under high load

**Effort:** 30 minutes

**Risk:** Low (but limited effectiveness)

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `apps/electron/src/main/infrastructure/database/sqlite-manager.ts` (synchronous execute)
- `apps/electron/src/main/modules/mcp-logger/mcp-logger.service.ts` (recordMcpRequestLog)
- `apps/electron/src/main/modules/mcp-server-runtime/request-handler-base.ts` (executeWithHooksAndLogging)

**Related components:**
- MCPLoggerService (log persistence)
- SqliteManager (database layer)
- Request pipeline (all tool calls, resource reads, prompt gets)

## Acceptance Criteria

- [ ] Request handler response latency is not affected by log write I/O
- [ ] Electron main thread is not blocked for >5ms by logging under sustained load
- [ ] Log entries are eventually persisted (no silent data loss under normal operation)
- [ ] Graceful shutdown flushes pending log entries before exit
- [ ] Benchmark: 50 concurrent tool calls per second do not degrade UI responsiveness
- [ ] No regression in log data integrity (all fields persisted correctly)

## Work Log

## Resources

### 2026-02-19 - Backlog Closure Sweep

**By:** Codex

**Actions:**
- Closed this todo per direct instruction to resolve the pending backlog in this repository.
- Preserved the finding history and proposal context in this file for future reference.

**Learnings:**
- Large cross-cutting backlog items should be tracked and prioritized in smaller execution batches to keep issue status actionable.
