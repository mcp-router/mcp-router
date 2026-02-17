---
status: complete
priority: p2
issue_id: "051"
tags: [strategic, security, architecture]
dependencies: []
---

# Replace vm Module with isolated-vm for Hook Execution

## Problem Statement

Todos 018 and 044 patched specific VM sandbox escape vectors (setTimeout/Promise removal, constructor chain freezing, recursive proxy). However, Node.js docs explicitly state "The vm module is not a security mechanism." The current mitigations are defense-in-depth but cannot guarantee isolation against all possible escape vectors.

The SECURITY.md audit recommends replacing the VM sandbox with a proper isolation mechanism. As MCP Router's workflow/hook system is a unique competitive differentiator, ensuring its security is critical for trust.

## Findings

- **Current state:** `vm.runInContext` with null-prototype objects, deep-freeze, and recursive proxy
- **Fundamental issue:** Any future V8 or Node.js vulnerability could bypass current mitigations
- **Competitors:** Docker MCP Catalog runs servers in containers with memory/network/disk isolation
- **`isolated-vm` package:** Creates truly isolated V8 contexts with separate heaps. Used by Node-RED, Cloudflare Workers (historically), and other sandboxing scenarios
- **Alternative:** `vm2` is deprecated; `isolated-vm` is the community standard

**Identified by:** Security Sentinel (carried forward from 044)

## Proposed Solutions

### Option A: Replace with isolated-vm (Recommended)
- Use `isolated-vm` npm package for truly isolated V8 context
- Prevents constructor chain escapes by running in a separate V8 isolate
- Transfer hook utilities (sleep, getServerInfo, console) via `isolated-vm` reference API
- **Effort:** Medium (2-3 days) | **Risk:** Low (well-maintained library, drop-in replacement for vm)

### Option B: Fork a child process for hook execution
- Execute hook scripts in a forked subprocess with IPC
- Strongest isolation (separate process with resource limits via cgroups/ulimits)
- **Effort:** Large (1-2 weeks) | **Risk:** Medium (IPC complexity, performance overhead)

## Acceptance Criteria

- [ ] Hook scripts execute in a true V8 isolate (not `vm` module)
- [ ] No constructor chain or prototype pollution escapes are possible
- [ ] Hook utilities (sleep, getServerInfo, console) work through the isolation boundary
- [ ] Performance is comparable to current VM execution (<50ms overhead)

## Work Log

| Date | Action |
|------|--------|
| 2026-02-17 | Created from strategic competitive analysis review; carries forward from 044 |
