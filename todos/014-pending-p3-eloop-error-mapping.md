---
status: pending
priority: p3
issue_id: "014"
tags: [code-review, bug, error-handling]
dependencies: ["006"]
---

# ELOOP Incorrectly Mapped to BrokenSymlinkError

## Problem Statement

In `skills-error-mapper.ts`, `ELOOP` (circular symlink chain) is mapped to `BrokenSymlinkError`, but ELOOP means circular links, not broken targets. This file is currently dead code (depends on #006).

## Proposed Solutions

### Solution A: Map ELOOP to SymlinkError

- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] ELOOP maps to SymlinkError with appropriate circular links message

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-05 | Identified by TypeScript reviewer | Semantic mismatch in error mapping |

## Resources

- File: apps/electron/src/main/modules/skills/skills-error-mapper.ts:98
