---
status: completed
priority: p3
issue_id: "012"
tags: [code-review, duplication, refactor]
dependencies: []
---

# UnifiedSkill Object Construction Duplicated 6 Times

## Problem Statement

The same 12-field `UnifiedSkill` object literal is constructed at 6 locations in `unified-skills.service.ts`.

## Proposed Solutions

### Solution A: Extract Builder Methods (Recommended)

Create `buildLocalUnifiedSkill()` and `buildDiscoveredUnifiedSkill()` helper methods.

- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] UnifiedSkill objects constructed via helper methods
- [ ] No duplicate 12-field object literals

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-05 | Identified by Pattern recognition specialist | 6 instances in one file |

## Resources

- File: apps/electron/src/main/modules/skills/unified-skills.service.ts
