---
status: pending
priority: p1
issue_id: "105"
tags: [code-review, architecture, encapsulation]
dependencies: []
---

# getMaps() Exposes Mutable Internal State of MCPServerManager

`MCPServerManager.getMaps()` returns raw references to its internal `servers`, `clients`, `serverNameToIdMap`, and `serverStatusMap` Maps. Multiple consumers (`RequestHandlers`, `ToolCatalogService`, `ToolCatalogHandler`, `TokenValidator`) hold direct mutable references to these Maps. Any consumer can mutate MCPServerManager's internals without going through its public API, bypassing validation, event emission, and state consistency checks.

## Problem Statement

At line 741, `getMaps()` returns the actual internal Maps by reference:

```typescript
public getMaps() {
  return {
    servers: this.servers,
    clients: this.clients,
    serverNameToIdMap: this.serverNameToIdMap,
    serverStatusMap: this.serverStatusMap,
  };
}
```

Consumers destructure and hold these references:

```typescript
// request-handlers.ts line 98
const maps = serverManager.getMaps();
this.servers = maps.servers;
this.clients = maps.clients;
this.serverNameToIdMap = maps.serverNameToIdMap;
this.serverStatusMap = maps.serverStatusMap;
```

This breaks encapsulation in several ways:
1. **Uncontrolled mutation** -- Any consumer can call `maps.servers.set()`, `maps.servers.delete()`, or `maps.serverStatusMap.set()` without MCPServerManager knowing.
2. **Event bypass** -- MCPServerManager emits events (`server-started`, `server-stopped`) during state transitions. Direct Map mutation skips these events, leaving the UI out of sync.
3. **Race conditions** -- Multiple consumers mutating the same Maps concurrently can produce inconsistent state.
4. **Debugging difficulty** -- When state corruption occurs, there is no audit trail of who modified the Map.

## Findings

**getMaps() returns raw references (line 741):**
```typescript
public getMaps() {
  return {
    servers: this.servers,
    clients: this.clients,
    serverNameToIdMap: this.serverNameToIdMap,
    serverStatusMap: this.serverStatusMap,
  };
}
```

**RequestHandlers holds mutable references (lines 98-106):**
```typescript
constructor(serverManager: MCPServerManager, toolCatalogService?: ToolCatalogService) {
  const maps = serverManager.getMaps();
  const tokenValidator = new TokenValidator(maps.serverNameToIdMap);
  super(tokenValidator);
  this.servers = maps.servers;
  this.clients = maps.clients;
  this.serverNameToIdMap = maps.serverNameToIdMap;
  this.serverStatusMap = maps.serverStatusMap;
```

**Locations:**
- `apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ts` line 741
- `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts` lines 98-106

## Proposed Solutions

### Option 1: Replace getMaps() with specific accessor methods

**Approach:** Remove `getMaps()` entirely. Add specific read-only accessor methods to MCPServerManager: `getServer(id)`, `getClient(id)`, `getServerIdByName(name)`, `isServerRunning(id)`, `getServerStatus(id)`, `getAllServerIds()`. Update all consumers to use these methods instead of holding Map references.

**Pros:**
- Strong encapsulation -- all access goes through MCPServerManager's API
- Easy to add validation, logging, or authorization to each accessor
- Eliminates all uncontrolled mutation
- Cleaner API surface

**Cons:**
- Larger refactor -- all consumers must be updated
- May introduce performance overhead if accessors are called frequently in hot paths
- RequestHandlers' iteration patterns need refactoring

**Effort:** 8-16 hours

**Risk:** Medium (broad refactor across multiple modules)

---

### Option 2: Return read-only snapshots

**Approach:** Change `getMaps()` to return `ReadonlyMap` types or frozen shallow copies. Consumers get a point-in-time snapshot they can read but not mutate. Add a refresh mechanism for consumers that need up-to-date data.

**Pros:**
- Prevents mutation without changing the consumer API shape
- TypeScript's `ReadonlyMap` catches mutations at compile time
- Moderate refactor effort

**Cons:**
- Snapshots become stale -- consumers need to know when to refresh
- Shallow copies of Maps with object values still allow mutation of the objects themselves
- Does not fully solve the architectural coupling

**Effort:** 3-5 hours

**Risk:** Low-Medium

---

### Option 3: Event-driven state sharing via EventEmitter

**Approach:** Instead of sharing Maps, have MCPServerManager emit state change events. Consumers subscribe to events and maintain their own derived state. MCPServerManager remains the single source of truth.

**Pros:**
- Decouples consumers from internal data structures
- Natural fit for the existing EventEmitter pattern in MCPServerManager
- Each consumer can maintain optimized local views

**Cons:**
- Significant architectural change
- Event ordering and consistency must be carefully managed
- Consumers need initialization logic to build initial state from events or snapshots

**Effort:** 16-24 hours

**Risk:** High (architectural overhaul)

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ts` (getMaps, line 741)
- `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts` (consumer, lines 98-106)
- `apps/electron/src/main/modules/tool-catalog/tool-catalog.service.ts` (consumer)
- `apps/electron/src/main/modules/tool-catalog/tool-catalog-handler.ts` (consumer)

**Related components:**
- MCPServerManager (server lifecycle management)
- RequestHandlers (request routing and handling)
- ToolCatalogService (tool aggregation)
- TokenValidator (server name to ID resolution)

## Acceptance Criteria

- [ ] No external code holds a direct mutable reference to MCPServerManager's internal Maps
- [ ] `getMaps()` is either removed or returns read-only/snapshot data
- [ ] All state mutations go through MCPServerManager's public methods
- [ ] State changes continue to emit appropriate events
- [ ] No regression in request handling, tool catalog, or server management functionality
- [ ] TypeScript compilation enforces read-only access (if using ReadonlyMap approach)

## Work Log

## Resources
