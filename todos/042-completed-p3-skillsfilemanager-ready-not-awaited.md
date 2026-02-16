---
status: completed
priority: p3
issue_id: "042"
tags: [code-review, performance]
dependencies: []
---

# SkillsFileManager.ready() Not Awaited by Callers

## Problem Statement

Finding 025 converted SkillsFileManager to async and added a `ready()` method that returns the init promise. However, no production caller awaits `ready()` before calling other methods. The constructor kicks off `ensureDirectory()` but methods could race with it.

## Findings

- **File:** `apps/electron/src/main/modules/skills/skills-file-manager.ts` lines 33-45
- `initPromise` is set in constructor, `ready()` returns it
- No callers in `skills.service.ts`, `unified-skills.service.ts`, or `skills.ipc.ts` call `ready()`
- Low practical risk since directory creation is fast and happens at startup

**Identified by:** Performance Oracle (MEDIUM)

## Proposed Solutions

### Option A: Await ready() in the singleton getter
- The `getInstance()` or first usage should await `ready()`
- **Effort:** Small (15 min) | **Risk:** Low

### Option B: Guard individual methods
- Each public method starts with `await this.initPromise`
- **Effort:** Small (30 min) | **Risk:** Low (slight overhead)

## Acceptance Criteria

- [x] `ready()` is awaited before first operation in production code
- [x] No race condition between init and first method call

## Work Log

| Date | Action |
|------|--------|
| 2026-02-16 | Created from second-round code review |
| 2026-02-16 | Added await this.initPromise at start of all 10 public async methods |
