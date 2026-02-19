---
status: pending
priority: p3
issue_id: "074"
tags: [code-review, security, performance]
dependencies: []
---

# Rate Limiter Max Bucket Count and YAGNI Consideration

## Problem Statement

The rate limiter creates unbounded buckets per unique key and may be over-engineered for a single-user desktop app.

## Findings

**Security Sentinel:** `rate-limiter.ts:90-103` creates a new bucket for each unique key with no cap on `this.buckets.size`. The cleanup timer only removes idle buckets every 5 minutes. An attacker generating unique keys could exhaust memory.

**Code Simplicity Reviewer:** The rate limiter is a token-bucket implementation with per-key overrides that rate-limits a single desktop user's own requests. For personal use, this is YAGNI. Default limits (60 req/min per client, 30/min per server/tool) are hardcoded with no UI to configure or disable them.

**Performance Oracle:** The `resolveConfig` linear prefix scan is O(1) in practice (only 2 overrides). No performance concern for current usage.

## Proposed Solutions

### Option A: Add max bucket count (Recommended if keeping rate limiter)
- Add `maxBuckets: 10000` configuration. Reject new keys at limit.
- **Effort:** Small | **Risk:** Low

### Option B: Remove rate limiter entirely (If personal-use only)
- Delete `rate-limiter.ts` and `enforceRateLimit()` calls in request-handlers.ts
- Re-implement simpler version if multi-user support is added
- **Effort:** Small | **Risk:** Must re-implement for multi-user

## Acceptance Criteria

- [ ] Rate limiter has bounded memory usage (max bucket count)
- [ ] OR: Rate limiter removed if not needed for single-user

## Work Log

| Date | Action |
|------|--------|
| 2026-02-17 | Created from multi-agent code review |
