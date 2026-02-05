---
status: pending
priority: p2
issue_id: "008"
tags: [code-review, performance, electron]
dependencies: []
---

# Synchronous I/O Blocking Main Process in listUnified()

## Problem Statement

`listUnified()` performs O(S * C * P) synchronous filesystem I/O calls in the Electron main process, blocking the event loop. `verifySymlink` calls `fs.lstatSync()`, `fs.readlinkSync()`, and `fs.existsSync()` synchronously. Additionally, `readSkillMd` reads all SKILL.md contents on every list call.

## Findings

- **Location**: `unified-skills.service.ts` `listUnified()` + `skills-file-manager.ts` `verifySymlink()`
- **Impact**: 20 skills x 5 clients = ~300 sync filesystem calls blocking the event loop
- **readSkillMd**: Content read eagerly even though UI only displays names in grid view
- **verifySymlink**: 3 sync I/O calls per invocation

## Proposed Solutions

### Solution A: Lazy Content Loading + Async Symlink Verification (Recommended)

1. Return `content: null` in `listUnified()`, load lazily when detail sheet opens
2. Convert `verifySymlink` to async using `fs.promises`
3. Parallelize symlink checks with `Promise.all()`

- **Effort**: Medium
- **Risk**: Low

## Acceptance Criteria

- [ ] `listUnified()` does not block the main event loop with sync I/O
- [ ] Content is loaded lazily, not eagerly on every list call
- [ ] `pnpm typecheck` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-05 | Identified by Performance oracle | O(S*C*P) sync I/O in main process |

## Resources

- File: apps/electron/src/main/modules/skills/unified-skills.service.ts
- File: apps/electron/src/main/modules/skills/skills-file-manager.ts
