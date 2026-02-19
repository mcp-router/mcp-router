---
status: pending
priority: p3
issue_id: "133"
tags: [code-review, naming]
dependencies: []
---

# File Misspelling: app-updator.ts Should Be app-updater.ts

## Problem Statement

`apps/electron/src/main/modules/system/app-updator.ts` contains a spelling error -- "updator" should be "updater." This is a minor naming issue but creates inconsistency and can confuse developers searching for update-related code.

## Findings

- `apps/electron/src/main/modules/system/app-updator.ts` -- misspelled filename
- The file is imported from `apps/electron/src/main.ts` (confirmed via grep for "app-updator")
- "Updater" is the standard English spelling (as used by Electron's own `autoUpdater` API)
- Single import reference found, making the rename straightforward

## Proposed Solutions

### Option 1: Rename the file

**Approach:** Rename `app-updator.ts` to `app-updater.ts`. Update the import in `main.ts` and any other references.

**Pros:**
- Correct spelling
- Consistent with Electron's `autoUpdater` naming
- Only one import to update

**Cons:**
- Git will show as delete + create (or rename with `git mv`)
- Trivial change with trivial risk

**Effort:** 5 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/system/app-updator.ts` -- rename to `app-updater.ts`
- `apps/electron/src/main.ts` -- update import path

**Related components:**
- Electron auto-update functionality

**Database changes:** None

## Resources

- Electron autoUpdater documentation

## Acceptance Criteria

- [ ] File renamed from `app-updator.ts` to `app-updater.ts`
- [ ] All imports updated
- [ ] Application builds and runs without errors
- [ ] Auto-update functionality still works

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Claude Code

**Actions:**
- Found misspelled filename via glob search
- Confirmed single import in `main.ts`
- Verified no other references to "app-updator"

**Learnings:**
- Only one file references this import, making rename trivial

## Notes
