---
status: completed
priority: p1
issue_id: "022"
tags: [code-review, architecture, agent-native]
dependencies: []
---

# SystemServer Not Connected to Any Transport

## Problem Statement

The SystemServer is initialized in `main.ts` but never connected to a transport. The 6 `router_*` tools are registered but completely unreachable by any agent. This is dead code from an agent's perspective -- 461 lines of tools that cannot be called.

## Findings

- **File:** `apps/electron/src/main.ts` line 308 -- `SystemServerService.initialize(serverManager)` called
- **File:** `apps/electron/src/main/modules/system-server/system-server.ts` -- `getServer()` returns SDK Server but nobody calls `server.connect(transport)`
- Grep across `mcp-server-runtime/` found zero references to SystemServer
- The aggregator server and HTTP server have no awareness of the SystemServer
- Todo `001-pending-p1-agent-native-router-management.md` acknowledges this gap

**Identified by:** Agent-Native Reviewer (P0), Architecture Strategist (Finding 1)

## Proposed Solutions

### Option A: Inject tools into RequestHandlers (Recommended)
- Route `router_*` prefixed tools through SystemServer in `handleCallTool`
- Tools appear alongside aggregated tools at `http://localhost:3282/mcp`
- **Effort:** Medium (1-2 hrs) | **Risk:** Low

### Option B: Register as separate HTTP endpoint
- Mount at `/system/mcp` with StreamableHTTP transport
- **Effort:** Medium (1-2 hrs) | **Risk:** Low but more moving parts

## Acceptance Criteria

- [ ] `router_*` tools appear in `tools/list` responses
- [ ] `router_*` tools can be called via the MCP endpoint
- [ ] Existing aggregated tools still work normally

## Work Log

| Date | Action |
|------|--------|
| 2026-02-16 | Created from multi-agent code review |
| 2026-02-16 | Fixed by parallel resolve agents |

## Resources

- `apps/electron/src/main/modules/system-server/system-server.ts`
- `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts`
- `todos/001-pending-p1-agent-native-router-management.md`
