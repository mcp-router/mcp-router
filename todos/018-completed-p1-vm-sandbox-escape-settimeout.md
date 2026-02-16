---
status: completed
priority: p1
issue_id: "018"
tags: [code-review, security, critical]
dependencies: []
---

# VM Sandbox Escape via setTimeout Exposure

## Problem Statement

The hook VM sandbox in `hook.service.ts` exposes the real Node.js `setTimeout` directly into the VM context. This is a **known VM sandbox escape vector** -- `setTimeout.constructor` is `Function`, which provides access to the global scope outside the sandbox, enabling full remote code execution.

## Findings

- **File:** `apps/electron/src/main/modules/workflow/hook.service.ts` lines 215-216
- `setTimeout` is listed in the sandbox globals alongside `Promise`
- Proof of concept: `setTimeout.constructor('return process')().mainModule.require('child_process').execSync('id')`
- The `sleep()` utility already provides a safe capped delay, making direct `setTimeout` exposure unnecessary
- `Promise` exposure is also risky but less directly exploitable

**Identified by:** Security Sentinel (CRITICAL-01), TypeScript Reviewer (HIGH-7)

## Proposed Solutions

### Option A: Remove setTimeout entirely (Recommended)
- Remove `setTimeout` and `Promise` from sandbox globals
- `sleep()` already wraps setTimeout safely
- **Effort:** Small (5 min) | **Risk:** Low -- hook scripts using setTimeout directly will break

### Option B: Wrap setTimeout in a safe proxy
- Create a proxy that doesn't expose `.constructor`
- **Effort:** Medium (30 min) | **Risk:** Medium -- proxy implementation must be airtight

## Acceptance Criteria

- [ ] `setTimeout` removed from VM sandbox globals
- [ ] `Promise` removed or wrapped safely
- [ ] Existing hook scripts that use `sleep()` still work
- [ ] No way to access `process`, `require`, or `child_process` from within sandbox

## Work Log

| Date | Action |
|------|--------|
| 2026-02-16 | Created from multi-agent code review |
| 2026-02-16 | Fixed by parallel resolve agents |

## Resources

- `apps/electron/src/main/modules/workflow/hook.service.ts`
- `docs/adr/hook/mcp-hook-api-reference.md`
