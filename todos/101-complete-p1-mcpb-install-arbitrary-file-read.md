---
status: complete
priority: p1
issue_id: "101"
tags: [code-review, security, path-traversal]
dependencies: []
---

# router_install_mcpb Allows Arbitrary File Read via Unvalidated Path

The `router_install_mcpb` system tool accepts a `filePath` parameter from any MCP client and reads it with `fs.readFileSync` with no path validation. An attacker-controlled agent could read sensitive files such as `/etc/passwd`, `~/.ssh/id_rsa`, or environment files, or cause a denial-of-service by reading special files like `/dev/zero`.

## Problem Statement

`handleInstallMcpb` (lines 1072-1076) reads an arbitrary file path supplied by an MCP client without performing any validation on the path. The file contents are read into memory as a `Buffer` and then passed to `processMcpbFile`. Even if `processMcpbFile` fails to parse the contents, the file has already been read into the Electron main process memory.

This is a path traversal / arbitrary file read vulnerability because:
- The `filePath` parameter comes from an untrusted MCP client (AI agent)
- No validation checks that the path ends with `.mcpb`
- No restriction to safe directories (downloads, home, workspace)
- No file size limit -- reading `/dev/zero` or a multi-GB file causes OOM
- `fs.readFileSync` is synchronous, blocking the event loop during the read

## Findings

**Unvalidated file read (lines 1072-1076):**
```typescript
private async handleInstallMcpb(filePath: string) {
  try {
    const fs = require("fs");
    const buffer = fs.readFileSync(filePath);     // reads ANY file
    const uint8Array = new Uint8Array(buffer);
```

**Attack scenarios:**
1. **Credential theft:** Agent calls `router_install_mcpb` with `filePath: "/Users/victim/.ssh/id_rsa"`. File contents are read and, if `processMcpbFile` throws, the error message may leak partial content.
2. **Environment variable exfiltration:** `filePath: "/Users/victim/.env"` reads API keys and secrets.
3. **Denial of service:** `filePath: "/dev/zero"` causes `readFileSync` to attempt reading an infinite stream, blocking the main thread and consuming all memory.

**Locations:**
- `apps/electron/src/main/modules/system-server/system-server.ts` lines 1072-1076

## Proposed Solutions

### Option 1: Extension validation + directory restriction + size check

**Approach:** Validate that the file path ends with `.mcpb` (case-insensitive). Restrict the path to be within the user's home directory or a configured downloads directory. Use `fs.statSync` to check file size before reading (e.g., max 50MB). Resolve symlinks with `fs.realpathSync` to prevent symlink bypass.

**Pros:**
- Comprehensive defense against all three attack vectors
- Simple to implement
- `.mcpb` extension check blocks most casual abuse

**Cons:**
- Directory restriction may block legitimate paths (e.g., external drives)
- Symlink resolution adds a small overhead

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: User confirmation dialog for agent-initiated installs

**Approach:** When `router_install_mcpb` is called by an agent (not the UI), show an Electron file dialog pre-populated with the suggested path. The user must confirm the file selection before any read occurs. This ensures the user sees and approves the exact file being read.

**Pros:**
- User is always in the loop
- No file is read without explicit approval
- Works regardless of file location

**Cons:**
- Interrupts agent workflow
- Requires Electron dialog integration in the system server

**Effort:** 2-4 hours

**Risk:** Low

---

### Option 3: Replace file path with file dialog (remove path parameter)

**Approach:** Remove the `filePath` input parameter entirely. When `router_install_mcpb` is called, always open an Electron file dialog filtered to `.mcpb` files. The agent can trigger the install flow, but the user picks the file.

**Pros:**
- Eliminates the vulnerability entirely
- Clean UX -- user always selects the file
- No path validation complexity

**Cons:**
- Agents cannot fully automate mcpb installation
- Changes the tool's API contract

**Effort:** 2-3 hours

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/system-server/system-server.ts` lines 1072-1076 (handleInstallMcpb)

**Related components:**
- System Server (agent-native tools)
- MCPB processing pipeline (`processMcpbFile`)
- Electron main process (file system access)

## Acceptance Criteria

- [ ] `router_install_mcpb` with a non-`.mcpb` path is rejected before any file read
- [ ] Paths outside the allowed directory set are rejected (e.g., `/etc/passwd`, `~/.ssh/id_rsa`)
- [ ] File size is checked before reading; files exceeding the limit are rejected
- [ ] Symlink resolution prevents bypass of directory restrictions
- [ ] Unit tests cover path validation (valid `.mcpb`, invalid extension, path traversal, oversized file)
- [ ] No sensitive file content is leaked in error messages

## Work Log

## Resources

### 2026-02-19 - Backlog Closure

**By:** Codex

**Disposition:** fixed

**Notes:** Hardened router_install_mcpb with realpath boundary checks, file-type/size validation before read, and async fs read in /Users/robdezendorf/Documents/GitHub/mcp-router/apps/electron/src/main/modules/system-server/system-server.ts.
