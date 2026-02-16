---
status: completed
priority: p2
issue_id: "029"
tags: [code-review, security]
dependencies: []
---

# CSP unsafe-eval Not Gated on Development Mode

## Problem Statement

The CSP header includes `'unsafe-eval'` and `'unsafe-inline'` in `script-src`. The variable is named `DEV_CSP` but is applied unconditionally (not gated behind `isDevelopment()`). This weakens XSS protection in production -- any XSS vector can escalate to full script execution via `eval()`.

## Findings

- **File:** `apps/electron/src/main.ts` lines 345-351
- `DEV_CSP` applied unconditionally to all sessions
- Contains `'unsafe-eval'` and `'unsafe-inline'`

**Identified by:** Security Sentinel (HIGH-05)

## Proposed Solutions

### Option A: Split dev/production CSP (Recommended)
- Strict CSP for production (no unsafe-eval)
- Relaxed CSP for development (webpack hot-reload needs it)
- **Effort:** Small (30 min) | **Risk:** Low

## Acceptance Criteria

- [ ] Production builds use strict CSP without unsafe-eval
- [ ] Development builds still work with hot-reload

## Work Log

| Date | Action |
|------|--------|
| 2026-02-16 | Created from multi-agent code review |
| 2026-02-16 | Fixed by parallel resolve agents |

## Resources

- `apps/electron/src/main.ts`
