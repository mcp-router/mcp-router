# Todos

Structured task tracking for code review findings and improvement items.

## Naming Convention

```
{NNN}-{status}-{priority}-{short-description}.md
```

- **NNN** -- Zero-padded sequential ID (001, 002, ...)
- **status** -- `pending` or `completed`
- **priority** -- `p1` (critical), `p2` (important), `p3` (nice-to-have)
- **short-description** -- Kebab-case summary

Example: `006-completed-p1-dead-code-new-files.md`

## Frontmatter Schema

Each file starts with YAML frontmatter:

```yaml
---
status: pending | completed
priority: p1 | p2 | p3
issue_id: "NNN"
tags: [code-review, bug, performance, ...]
dependencies: ["NNN", ...]   # IDs of blocking todos
---
```

## Priority Levels

| Level | Meaning | Examples |
|-------|---------|---------|
| p1 | Critical -- blocks shipping or causes data loss | Security bugs, dead code in new features, broken IPC |
| p2 | Important -- degrades quality or developer experience | Performance issues, type safety gaps, stale closures |
| p3 | Nice-to-have -- improves maintainability | Code duplication, minor refactors, error message quality |

## Lifecycle

1. **Created** as `NNN-pending-{priority}-{description}.md` with `status: pending`
2. **Worked on** -- update the Work Log table inside the file
3. **Completed** -- change frontmatter `status: completed` and rename file from `pending` to `completed`

## Structure

Each todo file contains:

- **Problem Statement** -- What is wrong and why it matters
- **Findings** -- Specific locations and details
- **Proposed Solutions** -- Options with pros/cons/effort/risk
- **Acceptance Criteria** -- How to verify the fix
- **Work Log** -- Dated entries tracking progress
- **Resources** -- Related files, ADRs, links
