---
status: completed
priority: p1
issue_id: "020"
tags: [code-review, security, typescript]
dependencies: []
---

# SystemServer No Runtime Input Validation

## Problem Statement

All 6 SystemServer tool handlers cast arguments via `as unknown as <Type>` without any runtime validation. TypeScript types provide zero runtime safety. Malformed arguments from MCP clients pass through silently, potentially causing crashes, data corruption, or injection attacks (especially `router_add_server` which creates persistent state with `command` and `env` fields).

## Findings

- **File:** `apps/electron/src/main/modules/system-server/system-server.ts` lines 58-81
- Every handler: `args as unknown as ListServersInput`, `args as unknown as GetServerInput`, etc.
- `router_add_server`: No validation of `command` for path traversal/injection, `env` values unsanitized, `remoteUrl` not validated for SSRF
- `router_list_servers`: `status` filter not validated against enum

**Identified by:** Security Sentinel (CRITICAL-03), TypeScript Reviewer (CRITICAL-1)

## Proposed Solutions

### Option A: Add Zod schema validation (Recommended)
- Define Zod schemas for each tool input, validate before dispatch
- Validate `remoteUrl` against existing `validateExternalUrl()`
- **Effort:** Medium (1 hr) | **Risk:** Low

### Option B: Manual field validation
- Check required fields and types manually per handler
- **Effort:** Medium (45 min) | **Risk:** Medium -- easy to miss fields

## Acceptance Criteria

- [ ] All 6 tool inputs validated at runtime before processing
- [ ] Invalid inputs return proper McpError with helpful messages
- [ ] `router_add_server` validates `remoteUrl` against SSRF blocklist
- [ ] String length limits enforced on name, command fields

## Work Log

| Date | Action |
|------|--------|
| 2026-02-16 | Created from multi-agent code review |
| 2026-02-16 | Fixed by parallel resolve agents |

## Resources

- `apps/electron/src/main/modules/system-server/system-server.ts`
- `apps/electron/src/main/modules/system-server/system-server.types.ts`
