---
status: pending
priority: p3
issue_id: "013"
tags: [code-review, performance, optimization]
dependencies: []
---

# Duplicate clientAppService.list() Calls and N+1 Pattern

## Problem Statement

`updateUnified()` calls `clientAppService.list()` twice. `syncToAllClients()` has N+1 pattern calling `enableForClient()` per client which each independently fetches skill and client data.

## Proposed Solutions

### Solution A: Hoist Shared Fetches + Batch-Aware Internal Method

- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] No duplicate `clientAppService.list()` calls within a single method
- [ ] `syncToAllClients` does not trigger N+1 DB lookups

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-05 | Identified by Performance oracle | N+1 pattern in sync operations |

## Resources

- File: apps/electron/src/main/modules/skills/unified-skills.service.ts
