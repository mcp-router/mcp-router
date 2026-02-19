---
status: pending
priority: p2
issue_id: "113"
tags: [code-review, security, performance]
dependencies: []
---

# No Rate Limiting on Session Creation Endpoints

While a MAX_SESSIONS=50 cap exists, there is no rate limit on session creation itself. An attacker can rapidly create and destroy sessions, causing CPU churn and resource exhaustion.

## Problem Statement

The MCP HTTP server and aggregator server enforce a maximum of 50 concurrent sessions, but there is no rate limit on the creation frequency. An attacker can:
1. Rapidly create sessions up to the 50 limit.
2. Immediately disconnect them (or let them time out).
3. Repeat in a tight loop, causing constant session setup/teardown overhead.
4. Each session creation involves transport initialization, authentication, and resource allocation.
5. This creates a denial-of-service vector where legitimate clients cannot connect because the server is continuously churning through malicious session cycles.

## Findings

- `apps/electron/src/main/modules/mcp-server-runtime/http/mcp-http-server.ts` line 26: `private readonly MAX_SESSIONS = 50;`
- `apps/electron/src/main/modules/mcp-server-runtime/aggregator-server.ts` line 35: `const MAX_SESSIONS = 50;`
- `aggregator-server.ts` line 78-84: `createSessionTransport()` checks `this.sessions.size >= MAX_SESSIONS` but has no rate limiting.
- `mcp-http-server.ts` line 346: SSE session check `if (this.sseSessions.size >= this.MAX_SESSIONS)` -- same pattern, no rate limit.
- `mcp-http-server.ts` line 241: `const transport = await this.aggregatorServer.createSessionTransport()` -- called on every new connection.
- No per-IP, per-token, or global rate limiting is applied to the session creation endpoint.

**Location:**
- `apps/electron/src/main/modules/mcp-server-runtime/http/mcp-http-server.ts`
- `apps/electron/src/main/modules/mcp-server-runtime/aggregator-server.ts`

## Proposed Solutions

### Option 1: Add rate limiter to session creation (recommended)

**Approach:** Apply a rate limiter (e.g., token bucket or sliding window) to session creation endpoints. Limit to N sessions per second per source (IP or token).

**Pros:**
- Directly addresses the DoS vector
- Can be tuned per deployment
- Works alongside the existing MAX_SESSIONS cap

**Cons:**
- Need to decide on rate limit parameters
- May affect legitimate burst scenarios (many clients connecting at once)

**Effort:** 2-3 hours

**Risk:** Low

---

### Option 2: Session creation cooldown per client

**Approach:** Track when each client (by token or IP) last created a session. Enforce a minimum interval (e.g., 1 second) between session creations from the same source.

**Pros:**
- Simple to implement
- Per-client fairness
- Does not affect other clients

**Cons:**
- Attackers can use multiple IPs/tokens to circumvent
- Cooldown tracking adds state

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 3: Exponential backoff on rapid session churn

**Approach:** Detect rapid create-destroy cycles and apply exponentially increasing delays to the offending client. After N rapid cycles, temporarily ban the client.

**Pros:**
- Adapts to attack intensity
- Minimal impact on legitimate usage
- Strong deterrent

**Cons:**
- More complex state tracking
- Need to tune thresholds carefully
- Ban logic requires careful implementation

**Effort:** 4-6 hours

**Risk:** Medium

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/mcp-server-runtime/http/mcp-http-server.ts` (session creation endpoint)
- `apps/electron/src/main/modules/mcp-server-runtime/aggregator-server.ts` (createSessionTransport)

**Related components:**
- Existing rate limiter (if any exists in the codebase -- check for reuse)
- Token validation middleware
- Session cleanup/timeout logic

## Acceptance Criteria

- [ ] Session creation is rate-limited (configurable threshold)
- [ ] Rapid create-destroy cycles do not cause CPU exhaustion
- [ ] Legitimate clients can still connect within normal usage patterns
- [ ] Rate limit exceeded response uses HTTP 429 with Retry-After header
- [ ] Rate limit state is cleaned up when sessions are destroyed normally
- [ ] Logging captures rate limit violations for monitoring

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Code Review

**Actions:**
- Identified MAX_SESSIONS cap without rate limiting
- Confirmed session creation endpoints have no frequency throttling
- Assessed DoS potential from rapid session churn
- Reviewed both HTTP server and aggregator server session management

**Learnings:**
- MAX_SESSIONS prevents connection exhaustion but not CPU exhaustion from rapid cycling
- Rate limiting at line 50 of mcp-http-server.ts was added for sampling but not for session creation

## Resources
