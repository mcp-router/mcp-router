---
status: pending
priority: p2
issue_id: "025"
tags: [code-review, performance]
dependencies: []
---

# Synchronous File I/O in SkillsFileManager Blocks Main Process

## Problem Statement

`SkillsFileManager` uses 20+ synchronous filesystem calls (`*Sync`) that block the Electron main process event loop. The `enableForClientWithData` method in `unified-skills.service.ts` also uses `fs.lstatSync` inside a loop over all clients during bulk sync operations.

## Findings

- **File:** `apps/electron/src/main/modules/skills/skills-file-manager.ts` -- 20+ `*Sync` calls
- **File:** `apps/electron/src/main/modules/skills/unified-skills.service.ts` line 1170 -- `fs.lstatSync(targetPath)`
- The parallel method `enableForClient` at line 468 correctly uses `await fsPromises.lstat()`
- Blocking the main process prevents UI updates and IPC handling during skill operations

**Identified by:** Performance Oracle (CRITICAL-3), Architecture Strategist (Finding 14)

## Proposed Solutions

### Option A: Convert SkillsFileManager to async (Recommended)
- Replace all `*Sync` calls with `fsPromises.*` equivalents
- Update callers to await
- **Effort:** Large (2 hrs) | **Risk:** Medium -- callers must be updated

### Option B: Move to worker thread
- Run SkillsFileManager operations in a Node.js Worker
- **Effort:** Large (3 hrs) | **Risk:** Medium -- adds complexity

## Acceptance Criteria

- [ ] No synchronous filesystem calls in SkillsFileManager
- [ ] `enableForClientWithData` uses async lstat
- [ ] Main process event loop not blocked during skill operations

## Work Log

| Date | Action |
|------|--------|
| 2026-02-16 | Created from multi-agent code review |

## Resources

- `apps/electron/src/main/modules/skills/skills-file-manager.ts`
- `apps/electron/src/main/modules/skills/unified-skills.service.ts`
