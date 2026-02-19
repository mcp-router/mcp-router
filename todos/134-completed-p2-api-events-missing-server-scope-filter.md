---
status: completed
priority: p2
issue_id: "134"
tags: [code-review, security, authorization, api]
dependencies: []
---

# Scope `/api/events` by token server access

The admin API endpoints now enforce per-server token access for `/api/servers*`, but `/api/events` still streams all bridge events to any authenticated token.

## Problem Statement

`GET /api/events` currently authorizes only by token validity and does not apply server-level authorization checks. This can leak operational metadata (server lifecycle/config/tool-permission events) for servers the caller should not access.

## Findings

- `api-router.ts` added per-server auth checks for `servers` endpoints but not for `events`.
- `/api/events` subscribes directly to the global `EventBridge` stream and forwards every event payload.
- `mcp-server-manager.ipc.ts` emits events such as `servers_updated`, `config_changed`, and `tool_list_changed` that can include server identifiers/config mutation details.

Evidence:
- `apps/electron/src/main/modules/mcp-server-runtime/http/api-router.ts:130`
- `apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ipc.ts:18`
- `apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ipc.ts:94`

## Proposed Solutions

### Option 1: Filter events in API router by token-accessible server IDs

**Approach:** Before writing SSE events, validate whether event payload references a server the token can access; drop unauthorized events.

**Pros:**
- Minimal architectural change
- Preserves current event model

**Cons:**
- Requires careful per-event payload parsing
- Risk of new event types bypassing filter if not maintained

**Effort:** Medium

**Risk:** Medium

---

### Option 2: Emit access-scoped channels from EventBridge

**Approach:** Extend EventBridge to support scoped subscriptions keyed by serverId/project and subscribe API clients only to authorized scopes.

**Pros:**
- Stronger long-term model
- Centralized auth-aware event routing

**Cons:**
- More invasive refactor
- Requires updates to emitters and subscribers

**Effort:** Large

**Risk:** Medium

## Recommended Action

Implemented Option 1 with targeted authorization helpers and tests:
- Added event-level authorization guard in `/api/events` before SSE write.
- Scoped checks to known server-related event types and parsed server IDs from top-level and nested payload structures.
- Added unit tests for authorized/unauthorized scoped events and no-token suppression.

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/mcp-server-runtime/http/api-router.ts`
- `apps/electron/src/main/modules/mcp-server-runtime/event-bridge.ts`
- `apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ipc.ts`
- `apps/electron/src/main/modules/mcp-server-runtime/http/__tests__/api-router-events-auth.test.ts`

**Related components:**
- Token authorization model (`TokenManager.hasServerAccess`)
- MCP server admin/event APIs

## Resources

- **Review target:** current `main` working tree diff
- **Related changes:** per-server auth added for `/api/servers*`

## Acceptance Criteria

- [x] `/api/events` does not deliver events for unauthorized servers
- [x] Authorized server events still stream correctly
- [x] Coverage added for at least one unauthorized-event suppression case
- [x] No regressions in existing SSE heartbeat behavior

## Work Log

### 2026-02-19 - Review Finding Created

**By:** Codex

**Actions:**
- Reviewed current admin API auth changes and event streaming path
- Confirmed `/api/events` lacks per-server authorization filtering
- Documented mitigation options and acceptance criteria

**Learnings:**
- Partial hardening exists (`/api/servers*`), but event stream remains global

### 2026-02-19 - Resolution

**By:** Codex

**Actions:**
- Refactored event authorization logic into testable helpers (`collectServerIdsFromEventData`, `isApiEventAuthorized`).
- Enforced per-event server access checks in `/api/events` SSE writer.
- Added `api-router-events-auth.test.ts` covering:
  - missing token rejection
  - non-scoped event passthrough
  - scoped event suppression for unauthorized server IDs
  - scoped event allow for fully authorized server IDs
- Validated with:
  - `pnpm --filter @mcp_router/electron exec eslint src/main/modules/mcp-server-runtime/http/api-router.ts src/main/modules/mcp-server-runtime/http/__tests__/api-router-events-auth.test.ts`
  - `pnpm --filter @mcp_router/electron test`
  - `pnpm --filter @mcp_router/electron test:e2e:only`

**Learnings:**
- Event payload server identifiers appear in multiple shapes (`serverId`, `id`, nested `server.id`, arrays under `result`), so authorization needs structured extraction to avoid bypasses.
