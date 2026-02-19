---
status: pending
priority: p1
issue_id: "102"
tags: [code-review, security, authentication]
dependencies: []
---

# Timing-Unsafe Token Comparison Enables Side-Channel Attacks

Token validation uses direct string comparison (`===`) which is vulnerable to timing side-channel attacks. Since the HTTP server binds to `127.0.0.1`, any local process can probe for valid tokens by measuring response times.

## Problem Statement

Token lookup in `SharedConfigManager.getToken()` (line 319) uses `Array.find()` with strict equality (`t.id === tokenId`). Similarly, `TokenManager.validateToken()` (line 56) passes the token ID through to repository lookup which also uses direct comparison. JavaScript's `===` operator short-circuits on the first differing character, leaking timing information about how many leading characters of the token match.

On localhost, timing differences are measurable with high precision (sub-millisecond). An attacker with local access (another application, malware, or a compromised browser extension) can:
1. Send thousands of requests varying one character at a time
2. Measure response latency to determine which prefix is correct
3. Reconstruct a valid token character by character

This is especially relevant because:
- The HTTP server binds to `127.0.0.1` and is accessible to all local processes
- Tokens are the primary authentication mechanism for MCP clients
- Rate limiting (if present) may not be aggressive enough to prevent statistical analysis

## Findings

**Direct comparison in SharedConfigManager (line 319):**
```typescript
getToken(tokenId: string): Token | undefined {
  const token = this.config.mcpApps.tokens.find((t) => t.id === tokenId);
  return token ? this.cloneToken(token) : undefined;
}
```

**Direct comparison in TokenManager (line 56):**
```typescript
public validateToken(tokenId: string): TokenValidationResult {
  const token = TokenManagerRepository.getInstance().getToken(tokenId);
  // ...
}
```

Both paths use JavaScript's native string `===` which is not constant-time.

**Locations:**
- `apps/electron/src/main/infrastructure/shared-config-manager.ts` line 319
- `apps/electron/src/main/modules/client-apps/token-manager.ts` line 56

## Proposed Solutions

### Option 1: SHA-256 hash + crypto.timingSafeEqual

**Approach:** Hash the incoming token ID with SHA-256 and compare against pre-hashed stored token IDs using `crypto.timingSafeEqual()`. Store hashed token IDs in the config. On lookup, hash the input, then iterate all tokens comparing hashes in constant time.

**Pros:**
- Industry-standard approach for timing-safe comparison
- `crypto.timingSafeEqual` is built into Node.js
- Hashing prevents leaking token structure even through memory dumps

**Cons:**
- Requires a migration to store hashed token IDs
- Existing tokens need to be re-hashed on first access
- Slightly slower due to hashing on every request

**Effort:** 3-5 hours

**Risk:** Low

---

### Option 2: crypto.timingSafeEqual on raw token buffers

**Approach:** Convert both the incoming token ID and stored token IDs to `Buffer` objects and compare using `crypto.timingSafeEqual()`. No hashing -- just ensure the comparison is constant-time. Pad shorter buffers to match length before comparison.

**Pros:**
- Simpler than hashing -- no migration needed
- Directly addresses the timing leak
- Minimal code change

**Cons:**
- Does not protect token values in memory (no hashing benefit)
- Must handle variable-length tokens carefully (pad to equal length)
- `timingSafeEqual` requires equal-length buffers

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 3: HMAC-based token validation

**Approach:** Generate tokens as HMAC signatures over a random nonce using a server-side secret. Validation recomputes the HMAC and uses `crypto.timingSafeEqual()`. This eliminates the need to store and compare raw token values.

**Pros:**
- Strongest security model -- tokens are cryptographically derived
- Constant-time validation is inherent to HMAC verification
- No token storage needed (stateless validation)

**Cons:**
- Significant architectural change to token generation
- Requires secure secret management
- Breaks compatibility with existing tokens

**Effort:** 8-16 hours

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `apps/electron/src/main/infrastructure/shared-config-manager.ts` (getToken, line 319)
- `apps/electron/src/main/modules/client-apps/token-manager.ts` (validateToken, line 56)

**Related components:**
- TokenValidator (request-handler-base.ts)
- MCPHttpServer (HTTP authentication middleware)
- Token generation and storage

## Acceptance Criteria

- [ ] Token comparison uses `crypto.timingSafeEqual()` or equivalent constant-time method
- [ ] Response time does not vary based on how many characters of the token match
- [ ] Existing tokens continue to work after the change (backward compatibility)
- [ ] Unit test demonstrates constant-time behavior (optional: statistical timing test)
- [ ] No raw token values are logged or leaked in error messages

## Work Log

## Resources
