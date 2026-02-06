---
status: completed
priority: p1
issue_id: "006"
tags: [code-review, dead-code, skills]
dependencies: []
---

# Dead Code: 4 New Files Have Zero Imports

## Problem Statement

Four new files totaling ~1,134 lines were added but are not imported anywhere in the codebase. This introduces dead code in the same changeset that removes dead code. The error hierarchy, error mapper, error utils, and Zustand store form a well-designed but completely disconnected subgraph.

## Findings

- **skills-errors.ts** (277 LOC): 16 error subclasses - only imported by skills-error-mapper.ts
- **skills-error-mapper.ts** (143 LOC): Not imported by any production file
- **skills-error-utils.ts** (207 LOC): Not imported by any renderer component or store
- **skills-store.ts** (507 LOC): Not imported by SkillsManager.tsx or stores/index.ts
- The service (`unified-skills.service.ts`) still throws plain `new Error()` strings everywhere
- The IPC layer does not serialize structured error properties (code, recoverable, details)
- All 6 review agents flagged this independently as the top finding

## Proposed Solutions

### Solution A: Wire In the Error System End-to-End (Recommended)

1. Import and use structured error classes in `unified-skills.service.ts`
2. Add IPC error serialization in `unified-skills.ipc.ts` to preserve toJSON() data
3. Import and use `handleSkillsError` in SkillsManager.tsx
4. Register skills-store in stores/index.ts and migrate SkillsManager to use it

- **Pros**: Completes the intended architecture, provides structured error handling
- **Cons**: Larger scope of change, IPC serialization is an architecture-wide concern
- **Effort**: Medium
- **Risk**: Medium

### Solution B: Remove Dead Code, Reintroduce With Consumers

Delete all 4 files. Reintroduce them in a future PR that also includes their consumers.

- **Pros**: Clean changeset, no dead code, follows "ship together" principle
- **Cons**: Loses the design work (can be preserved in a branch)
- **Effort**: Small
- **Risk**: Low

### Solution C: Keep as Staged Work with Documentation

Keep files but document explicitly as staged Phase 2 work in SKILLS_DESIGN.md ADR. Add knip ignore entries.

- **Pros**: Preserves work, documents intent
- **Cons**: Dead code remains, knip exceptions needed
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] No files with zero imports exist in the changeset
- [ ] If error system is wired: service throws structured errors, IPC preserves them, renderer handles them
- [ ] If removed: `pnpm knip` reports no unused exports related to skills errors
- [ ] `pnpm typecheck` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-05 | Identified by 6 parallel review agents | All agents independently flagged this as the top finding |

## Resources

- Files: skills-errors.ts, skills-error-mapper.ts, skills-error-utils.ts, skills-store.ts
- ADR: docs/adr/skills/SKILLS_DESIGN.md
