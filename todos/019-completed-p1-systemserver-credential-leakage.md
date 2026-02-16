---
status: completed
priority: p1
issue_id: "019"
tags: [code-review, security, critical]
dependencies: []
---

# SystemServer Credential Leakage via router_get_server

## Problem Statement

The `router_get_server` tool returns full server configuration including `env` (environment variables that commonly contain API keys like `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, database passwords), `remoteUrl` (may contain embedded credentials), and `command`/`args` (system paths). Any MCP client that can call this tool gets full credential access.

## Findings

- **File:** `apps/electron/src/main/modules/system-server/system-server.ts` lines 118-139
- `env: server.env` passed directly in response -- leaks all env vars
- `remoteUrl: server.remoteUrl` -- may contain auth tokens in URL
- Contrast with `getServerInfo()` in hook sandbox which correctly exposes only `{id, name, type, status, enabled}`

**Identified by:** Security Sentinel (CRITICAL-02)

## Proposed Solutions

### Option A: Redact env values (Recommended)
- Show env keys only, mask values with `***REDACTED***`
- Strip auth from remoteUrl
- **Effort:** Small (15 min) | **Risk:** Low

### Option B: Add include-secrets flag
- Default to redacted, allow explicit opt-in
- **Effort:** Medium (30 min) | **Risk:** Low

## Acceptance Criteria

- [ ] `router_get_server` does not return env variable values
- [ ] `remoteUrl` does not contain embedded credentials
- [ ] Server name, type, status, and non-sensitive config still returned

## Work Log

| Date | Action |
|------|--------|
| 2026-02-16 | Created from multi-agent code review |
| 2026-02-16 | Fixed by parallel resolve agents |

## Resources

- `apps/electron/src/main/modules/system-server/system-server.ts`
