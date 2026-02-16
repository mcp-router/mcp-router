---
status: completed
priority: p2
issue_id: "031"
tags: [code-review, quality]
dependencies: []
---

# enableForClient Code Duplication (~170 lines)

## Problem Statement

`enableForClient` (lines 423-519, ~97 lines) and `enableForClientWithData` (lines 1145-1218, ~74 lines) in `unified-skills.service.ts` do essentially the same thing -- validate client, resolve paths, create symlinks, update state. The only difference is pre-fetched vs re-fetched objects. This creates ~170 lines of near-identical code with maintenance drift risk.

## Findings

- **File:** `apps/electron/src/main/modules/skills/unified-skills.service.ts`
- `enableForClient`: lines 423-519 (async, uses `fsPromises.lstat`)
- `enableForClientWithData`: lines 1145-1218 (uses `fs.lstatSync`)

**Identified by:** Simplicity Reviewer (Finding 4), Architecture Strategist (Finding 14)

## Proposed Solutions

### Option A: Delegate enableForClient to enableForClientWithData (Recommended)
- `enableForClient` fetches data then calls `enableForClientWithData`
- Make `enableForClientWithData` async
- **Effort:** Small (30 min) | **Risk:** Low

## Acceptance Criteria

- [ ] Single implementation path for enable-for-client logic
- [ ] No synchronous filesystem calls in the shared implementation

## Work Log

| Date | Action |
|------|--------|
| 2026-02-16 | Created from multi-agent code review |
| 2026-02-16 | Fixed by parallel resolve agents |

## Resources

- `apps/electron/src/main/modules/skills/unified-skills.service.ts`
