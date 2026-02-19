---
title: "chore: lint baseline and review backlog closure"
type: chore
status: active
date: 2026-02-19
---

# chore: lint baseline and review backlog closure

## Overview

Stabilize repository quality gates after recent runtime/auth fixes by restoring passing lint execution, closing review todos already addressed by merged code, and handling local review-agent config hygiene.

## Scope

- [x] Make `pnpm turbo run lint` pass at workspace level.
- [x] Keep lint signal available while avoiding parser/config false negatives.
- [x] Close resolved pending todo items tied to shipped fixes.
- [ ] Resolve all historical pending todos (out of scope for one pass; tracked backlog).
- [x] Ensure `compound-engineering.local.md` remains local-only and uncommitted.

## Work Plan

- [x] Update Electron ESLint config to remove parser failures and normalize runtime globals.
- [x] Run lint autofix to apply deterministic formatting changes.
- [x] Re-run workspace lint and confirm non-zero failures are eliminated.
- [x] Audit pending todos for items now resolved by latest runtime/e2e commits.
- [x] Convert resolved pending todos to completed status and filename convention.
- [x] Verify git status excludes `compound-engineering.local.md` from commits.

## Acceptance Criteria

- [x] `pnpm turbo run lint` exits successfully.
- [x] Resolved todos are renamed `*-completed-*` and contain resolution logs.
- [x] No commit includes `compound-engineering.local.md`.

## Notes

The remaining pending todo backlog is substantial and represents product/security roadmap work, not a single cleanup patch.
