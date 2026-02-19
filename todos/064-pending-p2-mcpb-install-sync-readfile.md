---
status: pending
priority: p2
issue_id: "064"
tags: [code-review, performance, electron, mcpb]
dependencies: []
---

# MCPB Install Uses Synchronous Read Without Pre-Size Check

`router_install_mcpb` reads the full file synchronously on the main process with no pre-read size guard. A large or malicious file can block the Electron main thread or spike memory before size validation occurs.

## Problem Statement

Installing a `.mcpb` file can freeze the app or cause memory pressure if a user provides a large file, because `fs.readFileSync()` loads the entire file before size limits are enforced.

## Findings

- `handleInstallMcpb()` uses `fs.readFileSync(filePath)` on the main process.
- The size guard exists *after* reading, so it does not prevent blocking or OOM.

**Location:**
- `apps/electron/src/main/modules/system-server/system-server.ts`

## Proposed Solutions

### Option 1: Pre-check size with `fs.stat` and reject early

**Approach:** Use `fs.statSync`/`fs.promises.stat` to check file size before reading. Reject if above MAX_ARCHIVE_SIZE_BYTES.

**Pros:**
- Simple
- Prevents large file reads

**Cons:**
- Still reads whole file into memory after check

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Use async streaming read with early abort

**Approach:** Stream file contents into a buffer with a hard cap; abort if limit exceeded.

**Pros:**
- Avoids blocking main thread
- Enforces cap during read

**Cons:**
- More code

**Effort:** 3-5 hours

**Risk:** Medium

---

### Option 3: Move install to worker process

**Approach:** Offload file read and extraction to a worker thread or separate process.

**Pros:**
- No main-thread blocking
- Scales better for large operations

**Cons:**
- Higher complexity

**Effort:** 1-2 days

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/system-server/system-server.ts`

**Related components:**
- MCPB installer
- Electron main process

## Resources

- **Branch:** current `main` local changes

## Acceptance Criteria

- [ ] Install rejects files above size cap before full read
- [ ] Main process remains responsive during install
- [ ] Error messages clearly indicate size limits

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Codex

**Actions:**
- Identified synchronous file read in install path
- Noted size limit enforced only after read
- Drafted remediation options

**Learnings:**
- Sync read paths in Electron main are high-risk for UX

