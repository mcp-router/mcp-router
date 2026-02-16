---
status: completed
priority: p2
issue_id: "028"
tags: [code-review, typescript]
dependencies: []
---

# request-handlers.ts `any` Types on Critical Data Path

## Problem Statement

Nearly every public method in `request-handlers.ts` uses `any` -- the most critical data path in the application that routes ALL tool calls, resources, and prompts. New code added in this branch (parallel tool fetching) also introduces `any` for the eligible server array.

## Findings

- **File:** `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts`
- Line 139: `handleListTools(...): Promise<any>`
- Line 157: `handleCallTool(request: any): Promise<any>`
- Line 189: `handleListResources(...): Promise<any>`
- Lines 607-611: `eligible` array with `client: any`, `server: any`

**Identified by:** TypeScript Reviewer (CRITICAL-4)

## Proposed Solutions

### Option A: Type with MCP SDK types (Recommended)
- Use `CallToolRequest`, `ListToolsResult`, etc. from `@modelcontextprotocol/sdk`
- **Effort:** Medium (1-2 hrs) | **Risk:** Low

## Acceptance Criteria

- [ ] No `any` in public method signatures of request-handlers.ts
- [ ] Return types match MCP SDK protocol types

## Work Log

| Date | Action |
|------|--------|
| 2026-02-16 | Created from multi-agent code review |
| 2026-02-16 | Fixed by parallel resolve agents |

## Resources

- `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts`
