---
status: pending
priority: p2
issue_id: "011"
tags: [code-review, typescript, type-safety]
dependencies: []
---

# catch (error: any) Used Instead of unknown Throughout Skills Module

## Problem Statement

The service and component use `catch (error: any)` in 10+ locations instead of `catch (error: unknown)` with proper type narrowing.

## Findings

- **unified-skills.service.ts**: 8 instances of `catch (error: any)`
- **SkillsManager.tsx**: 2 instances at lines 151, 168
- The error mapper (`skills-error-mapper.ts`) was created for this exact pattern but is unused

## Proposed Solutions

### Solution A: Use error: unknown with Type Narrowing (Recommended)

- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] No `catch (error: any)` in skills module files
- [ ] All error property access uses proper type narrowing
- [ ] `pnpm typecheck` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-05 | Identified by TypeScript reviewer | 10+ instances across service and component |

## Resources

- File: apps/electron/src/main/modules/skills/unified-skills.service.ts
- File: apps/electron/src/renderer/components/skills/SkillsManager.tsx
