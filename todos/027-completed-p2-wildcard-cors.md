---
status: completed
priority: p2
issue_id: "027"
tags: [code-review, security]
dependencies: []
---

# Wildcard CORS on HTTP Server

## Problem Statement

The HTTP server uses `cors()` with default options (`Access-Control-Allow-Origin: *`). While bound to `127.0.0.1`, this allows any website loaded in a browser on the same machine to make requests to the MCP Router HTTP API, potentially enumerating servers and exfiltrating data.

## Findings

- **File:** `apps/electron/src/main/modules/mcp-server-runtime/http/mcp-http-server.ts` line 51
- `this.app.use(cors())` -- no origin restriction

**Identified by:** Security Sentinel (HIGH-01)

## Proposed Solutions

### Option A: Restrict CORS origins (Recommended)
- Allow only specific origins (localhost, mcp-router.net)
- **Effort:** Small (10 min) | **Risk:** Low

## Acceptance Criteria

- [ ] CORS configured with explicit origin allowlist
- [ ] Legitimate MCP clients still connect successfully

## Work Log

| Date | Action |
|------|--------|
| 2026-02-16 | Created from multi-agent code review |
| 2026-02-16 | Fixed by parallel resolve agents |

## Resources

- `apps/electron/src/main/modules/mcp-server-runtime/http/mcp-http-server.ts`
