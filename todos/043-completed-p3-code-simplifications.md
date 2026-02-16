---
status: completed
priority: p3
issue_id: "043"
tags: [code-review, quality]
dependencies: []
---

# Minor Code Simplifications

## Problem Statement

Several small code quality improvements identified in the fix commits. Each is minor individually (~20 lines total), grouped into one todo.

## Findings

1. **createSkillDirectory pattern:** `skills-file-manager.ts` has a nested try/catch for directory creation that could use the existing `pathExists()` helper (17 lines → 3 lines)
2. **Unused type aliases:** `GetSettingsInput` and `ListWorkspacesInput` in `system-server.types.ts` are defined but never used (YAGNI)
3. **Duplicated safeSettings object:** SharedConfigManager creates the same settings object structure in two places

**Identified by:** Code Simplicity Reviewer (MINOR)

## Proposed Solutions

### Option A: Apply all simplifications in one pass
- Use pathExists helper in createSkillDirectory
- Remove unused type aliases
- Extract shared settings object
- **Effort:** Small (20 min) | **Risk:** None

## Acceptance Criteria

- [x] createSkillDirectory uses pathExists helper
- [x] Unused type aliases removed
- [x] No duplicated object construction

## Work Log

| Date | Action |
|------|--------|
| 2026-02-16 | Created from second-round code review |
| 2026-02-16 | Simplified createSkillDirectory; removed GetSettingsInput/ListWorkspacesInput; consolidated saveSettings |
