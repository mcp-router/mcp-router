---
status: pending
priority: p3
issue_id: "129"
tags: [code-review, naming, consistency]
dependencies: []
---

# IPC Channel Naming Inconsistency (camelCase vs kebab-case)

## Problem Statement

IPC channel names mix camelCase and kebab-case for actions, use inconsistent singular/plural module names, and include one excessively long channel name. This inconsistency makes it harder to discover channels, predict naming, and maintain the IPC surface area.

## Findings

**camelCase actions:**
- `skill:getContent`
- `skill:getWithContent`
- `skill:openFolder`
- `skill:listAgentPaths`
- `skill:deleteAgentPath`
- `skill:selectAgentPathFolder`
- `marketplace:githubStats`

**kebab-case actions:**
- `skill:list-unified`
- `skill:get-unified`
- `skill:sync-to-all`
- `skill:verify-and-repair`
- `skill:enable-all`
- `skill:disable-all`
- `cloud-sync:set-enabled`
- `hook-module:list`

**Singular vs plural module names:**
- `client-app:list` (singular)
- `client-apps:discover-skills` (plural)

**Excessively long channel:**
- `settings:increment-package-manager-overlay-count`

**Pattern observation:**
- Original channels (skills.ipc.ts) use camelCase
- Newer channels (unified-skills.ipc.ts) use kebab-case
- This suggests organic drift over time rather than intentional design

## Proposed Solutions

### Option 1: Standardize on kebab-case for all actions

**Approach:** Rename all IPC channels to use `module:kebab-case-action` format. Standardize on singular module names. Update all preload.ts bindings, platform-api implementations, and renderer callers.

**Pros:**
- Consistent, predictable naming
- kebab-case is the natural convention for IPC channels (matches HTML/CSS conventions)
- Easier to discover and autocomplete

**Cons:**
- Touches many files (IPC handlers, preload, platform-api, renderer stores)
- Risk of missing a reference and breaking a feature
- No functional benefit, purely cosmetic

**Effort:** 4-6 hours

**Risk:** Medium -- wide-reaching rename across IPC boundary

---

### Option 2: Document the convention and enforce for new channels only

**Approach:** Add a naming convention to CLAUDE.md and a lint rule or code review checklist item. Apply kebab-case to new channels going forward. Leave existing channels as-is.

**Pros:**
- Zero risk of regressions
- Prevents further drift
- Pragmatic approach

**Cons:**
- Inconsistency persists indefinitely
- Two naming styles in the same file (unified-skills.ipc.ts)

**Effort:** 30 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/skills/skills.ipc.ts` -- camelCase channels
- `apps/electron/src/main/modules/skills/unified-skills.ipc.ts` -- kebab-case channels
- `apps/electron/src/main/modules/workflow/hook.ipc.ts` -- kebab-case
- `apps/electron/src/main/modules/workflow/workflow.ipc.ts` -- mixed
- `apps/electron/src/main/modules/client-apps/client-app.ipc.ts` -- singular
- `apps/electron/src/main/modules/settings/settings.ipc.ts` -- long name
- `apps/electron/src/preload.ts` -- all channel bindings
- `apps/electron/src/renderer/platform-api/` -- all API implementations
- Renderer stores that call IPC

**Related components:**
- Preload bridge (contextBridge.exposeInMainWorld)
- PlatformAPI interface definitions
- Renderer store actions

**Database changes:** None

## Resources

- CLAUDE.md IPC naming guidance: "Use `feature:action` format (e.g., `workspace:list`)"

## Acceptance Criteria

- [ ] IPC naming convention documented (kebab-case for multi-word actions)
- [ ] Either all channels migrated to consistent format, or convention enforced for new channels
- [ ] Singular/plural module names standardized
- [ ] No broken IPC calls after migration (if Option 1)

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Claude Code

**Actions:**
- Sampled IPC channel registrations across all .ipc.ts files
- Categorized channels by naming convention
- Identified camelCase vs kebab-case split along original vs newer code
- Found singular/plural inconsistency in client-app(s) module

**Learnings:**
- CLAUDE.md already specifies `feature:action` format but does not specify casing
- Newer code (unified-skills) consistently uses kebab-case
- Older code (skills) consistently uses camelCase

## Notes

### 2026-02-19 - Backlog Closure

**By:** Codex

**Disposition:** deferred-tech-debt

**Notes:** Closed as deferred technical debt after review; requires larger architectural or product-scope changes beyond this hardening pass.

### 2026-02-19 - Reopened Deferred Backlog

**By:** Codex

**Action:** Reopened from complete to pending per user instruction because the work is deferred, not implemented.

**Tracking:** Included in /Users/robdezendorf/Documents/GitHub/mcp-router/todos/DEFERRED_BACKLOG.md.
