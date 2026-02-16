---
status: pending
priority: p2
issue_id: "030"
tags: [code-review, security]
dependencies: []
---

# Auth Token Stored in Plaintext JSON

## Problem Statement

Auth tokens and MCP client API tokens are stored in plaintext in `shared-config.json` with default file permissions (typically `0o644`). Any process running as the same user can read credentials.

## Findings

- **File:** `apps/electron/src/main/modules/auth/auth.service.ts` lines 161-163 -- token written to settings
- **File:** `apps/electron/src/main/infrastructure/shared-config-manager.ts` lines 119-126 -- `writeFileSync` with no mode
- MCP client tokens also stored in same JSON file (lines 262-276)

**Identified by:** Security Sentinel (HIGH-04, MEDIUM-05)

## Proposed Solutions

### Option A: Encrypt with Electron safeStorage (Recommended)
- Use `safeStorage.encryptString()` for sensitive tokens
- Set file permissions to `0o600`
- **Effort:** Medium (1 hr) | **Risk:** Low

### Option B: Just fix file permissions
- Set `mode: 0o600` on writeFileSync
- **Effort:** Small (5 min) | **Risk:** None -- but tokens still plaintext

## Acceptance Criteria

- [ ] Config file written with restrictive permissions (0o600)
- [ ] Sensitive tokens encrypted at rest (stretch goal)

## Work Log

| Date | Action |
|------|--------|
| 2026-02-16 | Created from multi-agent code review |

## Resources

- `apps/electron/src/main/infrastructure/shared-config-manager.ts`
- `apps/electron/src/main/modules/auth/auth.service.ts`
