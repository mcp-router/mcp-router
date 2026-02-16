---
status: completed
priority: p3
issue_id: "034"
tags: [code-review, security]
dependencies: []
---

# Command Injection Risk in commandExists IPC

## Problem Statement

The `system:commandExists` IPC handler passes renderer-supplied `command` string directly to `execa` without validation. While `execa` doesn't use shell mode (mitigating basic injection), the `where` command on Windows can be abused with special characters. No allowlist validation exists.

## Findings

- **File:** `apps/electron/src/main/utils/env-utils.ts` lines 83-101
- **File:** `apps/electron/src/preload.ts` lines 88-89

**Identified by:** Security Sentinel (HIGH-03)

## Proposed Solutions

### Option A: Allowlist validation (Recommended)
- Only allow known commands: `node`, `npm`, `npx`, `pnpm`, `uvx`, `python`, `uv`, etc.
- **Effort:** Small (15 min) | **Risk:** Low

## Acceptance Criteria

- [ ] `commandExists` only accepts commands from an allowlist
- [ ] Unknown commands rejected with clear error

## Work Log

| Date | Action |
|------|--------|
| 2026-02-16 | Created from multi-agent code review |
| 2026-02-16 | Fixed by parallel resolve agents |
