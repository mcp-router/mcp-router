---
status: complete
priority: p2
issue_id: "110"
tags: [code-review, security]
dependencies: []
---

# MCPB Command Allowlist Bypassable via Regex Fallback

The MCPB command validation has a regex fallback that allows forward slashes, enabling commands like `/bin/sh` to pass validation.

## Problem Statement

`mcpb-processor.ts` validates the command field from MCPB bundles using a two-tier check:
1. First checks against an explicit `allowedCommands` list (safe).
2. Falls back to a regex `/^[a-zA-Z0-9_\-\.\/]+$/` that allows any string matching the pattern (unsafe).

The regex allows forward slashes (`/`), which means absolute paths like `/bin/sh`, `/usr/bin/env`, or `../../bin/malicious` pass validation. A crafted MCPB bundle could specify arbitrary commands that are not on the allowlist but pass the regex.

## Findings

- `apps/electron/src/main/modules/mcp-server-manager/mcpb-processor/mcpb-processor.ts` lines 155-168:
  ```typescript
  const allowedCommands = [
    // ... explicit list of safe commands
  ];
  // ...
  allowedCommands.includes(manifest.server.mcp_config.command) ||
    /^[a-zA-Z0-9_\-\.\/]+$/.test(manifest.server.mcp_config.command);
  ```
- The regex character class `[a-zA-Z0-9_\-\.\/]` explicitly includes `/` (forward slash) and `.` (dot).
- Paths like `/bin/sh`, `./payload`, `../../../etc/passwd` all match the regex.
- The allowedCommands list exists with safe entries, but the `||` with the regex nullifies its protective value.

**Location:**
- `apps/electron/src/main/modules/mcp-server-manager/mcpb-processor/mcpb-processor.ts` lines 155-168

## Proposed Solutions

### Option 1: Remove regex fallback entirely (recommended)

**Approach:** Only allow commands that are in the explicit `allowedCommands` list. Remove the regex fallback.

**Pros:**
- Strongest security posture
- Clear, auditable allowlist
- No ambiguity about what commands are permitted

**Cons:**
- MCPB bundles with unlisted commands will fail to install
- Need to ensure the allowedCommands list is comprehensive

**Effort:** 30 minutes

**Risk:** Low (may need to expand allowlist for legitimate commands)

---

### Option 2: Restrict regex to disallow path separators

**Approach:** Change the regex to `/^[a-zA-Z0-9_\-\.]+$/` (remove forward slash) so only simple command names pass.

**Pros:**
- Still allows non-listed simple commands like `custom-tool`
- Blocks absolute and relative path injection
- Minimal change

**Cons:**
- Still allows arbitrary command names, just not paths
- A malicious command named `rm` or `dd` could still pass

**Effort:** 15 minutes

**Risk:** Medium (weaker than Option 1)

---

### Option 3: Allowlist with user confirmation for unknown commands

**Approach:** If a command is not in the allowlist, prompt the user for confirmation before installation with a clear security warning.

**Pros:**
- Does not block legitimate edge cases
- User gets explicit control
- Security boundary maintained

**Cons:**
- Requires UI interaction for the confirmation
- Users may rubber-stamp the warning

**Effort:** 2-3 hours

**Risk:** Medium

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/mcp-server-manager/mcpb-processor/mcpb-processor.ts` lines 155-168

**Related components:**
- MCPB bundle installation pipeline
- DXT processor (may have similar pattern -- check `dxt-processor.ts`)
- Server spawn logic (downstream consumer of the validated command)

## Acceptance Criteria

- [ ] Commands with forward slashes (`/bin/sh`, `./payload`) are rejected
- [ ] Commands with path traversal (`../malicious`) are rejected
- [ ] All existing legitimate allowedCommands still pass validation
- [ ] MCPB installation with a known-good bundle succeeds
- [ ] MCPB installation with a crafted malicious command is blocked
- [ ] Error message clearly indicates why the command was rejected

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Code Review

**Actions:**
- Identified regex fallback that allows path separators in command validation
- Confirmed `/bin/sh` and relative paths pass the regex
- Reviewed allowedCommands list for completeness

**Learnings:**
- The regex was likely added to handle edge cases not in the allowlist, but it undermines the security purpose of the allowlist

## Resources

### 2026-02-19 - Backlog Closure

**By:** Codex

**Disposition:** fixed

**Notes:** Closed allowlist bypass by rejecting path-based commands and validating exact allowlisted command names in /Users/robdezendorf/Documents/GitHub/mcp-router/apps/electron/src/main/modules/system-server/system-server.ts.
