---
status: completed
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

### Option A: Encrypt with Electron safeStorage (Recommended) -- IMPLEMENTED
- Use `safeStorage.encryptString()` for sensitive tokens
- Set file permissions to `0o600`
- **Effort:** Medium (1 hr) | **Risk:** Low

### Option B: Just fix file permissions -- DONE (prior commit)
- Set `mode: 0o600` on writeFileSync
- **Effort:** Small (5 min) | **Risk:** None -- but tokens still plaintext

## Acceptance Criteria

- [x] Config file written with restrictive permissions (0o600)
- [x] Sensitive tokens encrypted at rest using Electron safeStorage

## Work Log

| Date | Action |
|------|--------|
| 2026-02-16 | Created from multi-agent code review |
| 2026-02-16 | File permissions fixed to 0o600 in prior commit |
| 2026-02-16 | Implemented safeStorage encryption for authToken and MCP client token IDs |

## Implementation Details

- Created `apps/electron/src/main/utils/safe-storage.ts` utility wrapping Electron's `safeStorage` API
- Modified `SharedConfigManager.saveConfig()` to encrypt `authToken` and `Token.id` before writing to disk
- Modified `SharedConfigManager.loadConfig()` to decrypt on read, with transparent migration of plaintext values
- Encrypted values use `enc:` prefix for identification; plaintext values are auto-migrated on first load
- Falls back to plaintext storage if `safeStorage.isEncryptionAvailable()` returns false
- Encryption is fully transparent -- no callers (auth.service, token-manager, etc.) needed changes

## Resources

- `apps/electron/src/main/utils/safe-storage.ts`
- `apps/electron/src/main/infrastructure/shared-config-manager.ts`
- `apps/electron/src/main/modules/auth/auth.service.ts`
