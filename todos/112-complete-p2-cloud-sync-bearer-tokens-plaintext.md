---
status: complete
priority: p2
issue_id: "112"
tags: [code-review, security]
dependencies: []
---

# Cloud Sync Includes Bearer Tokens in Sync Bundle

`serializeServer()` in `cloud-sync.service.ts` includes `bearerToken` in the cloud sync bundle, exposing MCP server credentials if the passphrase is weak.

## Problem Statement

The cloud sync feature serializes the full server configuration including `bearerToken` (line 372) into a bundle that is encrypted with a user-provided passphrase and uploaded to cloud storage. If:
1. The user chooses a weak passphrase (e.g., "password123"), the bundle can be brute-forced.
2. The cloud storage is compromised, all bearer tokens for all MCP servers are exposed.
3. Bearer tokens are long-lived secrets that grant direct API access to remote MCP servers.

This creates a single point of failure where one weak passphrase exposes all server credentials.

## Findings

- `apps/electron/src/main/modules/cloud-sync/cloud-sync.service.ts` line 372:
  ```typescript
  bearerToken: server.bearerToken,
  ```
  This is inside a `serializeServer()` method that converts server config to a JSON-serializable form for the sync bundle.
- The full serialized object at lines 365-378 includes: id, name, serverType, command, args, env, remoteUrl, bearerToken, autoStart, disabled, description, projectId, toolPermissions.
- The `env` field (line 370) may also contain sensitive values (API keys, tokens in environment variables).
- Encryption is passphrase-based, with no minimum strength enforcement visible.

**Location:**
- `apps/electron/src/main/modules/cloud-sync/cloud-sync.service.ts` lines 365-378 (especially line 372)

## Proposed Solutions

### Option 1: Exclude secrets from sync bundle (recommended)

**Approach:** Remove `bearerToken` from the serialized output. After restoring from a sync bundle, the user must re-enter bearer tokens for remote servers.

**Pros:**
- Eliminates the risk entirely
- Bearer tokens never leave the device
- No change to encryption scheme needed

**Cons:**
- User must re-enter bearer tokens on each new device
- Slightly worse UX for users with many remote servers

**Effort:** 30 minutes

**Risk:** Low

---

### Option 2: Enforce minimum passphrase strength

**Approach:** Require a minimum passphrase length (e.g., 16 characters) or entropy score before allowing cloud sync. Use a key derivation function with high cost (Argon2id or scrypt with high parameters).

**Pros:**
- Bearer tokens still sync (better UX)
- Strong passphrases resist brute-force

**Cons:**
- Does not protect against cloud storage compromise if passphrase is leaked
- Users may resist strong passphrase requirements
- Does not address the fundamental risk of secrets in the bundle

**Effort:** 3-4 hours

**Risk:** Medium

---

### Option 3: Separate secrets bundle with hardware-backed encryption

**Approach:** Create a separate secrets bundle that uses device-specific encryption (OS keychain, hardware security module) or requires a second, independent passphrase.

**Pros:**
- Secrets are independently protected
- Non-secret config syncs easily
- Defense in depth

**Cons:**
- Significant implementation effort
- Hardware-backed encryption may not be available on all platforms
- Two-step restore process

**Effort:** 1-2 days

**Risk:** Medium

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/cloud-sync/cloud-sync.service.ts` lines 365-378

**Related components:**
- Cloud sync upload/download pipeline
- Passphrase encryption implementation
- Server configuration model
- `env` field may also contain secrets (API keys in environment variables)

## Acceptance Criteria

- [ ] `bearerToken` is not included in the cloud sync bundle
- [ ] Servers restored from sync bundle have `bearerToken` set to empty/null
- [ ] User is informed that bearer tokens must be re-entered after restore
- [ ] Existing sync bundles without bearer tokens can still be imported
- [ ] Consider also excluding sensitive `env` values (separate follow-up)

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Code Review

**Actions:**
- Identified bearer token inclusion in cloud sync serialization
- Reviewed encryption scheme (passphrase-based)
- Assessed impact of weak passphrases on credential exposure
- Noted `env` field as additional risk

**Learnings:**
- Secrets-in-sync is a common pattern in config sync tools, but the risk is high for long-lived API tokens
- The `env` field is also a concern since it often contains API keys

## Resources

### 2026-02-19 - Backlog Closure

**By:** Codex

**Disposition:** already-fixed

**Notes:** Verified the issue is already addressed in current main branch code; no additional patch required in this pass.
