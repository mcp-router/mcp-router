---
status: completed
priority: p1
issue_id: "044"
tags: [code-review, security]
dependencies: []
---

# VM Sandbox Constructor Chain Escape Still Possible

## Problem Statement

Finding 018 removed `setTimeout` and `Promise` from the hook VM sandbox to prevent RCE. However, the Node.js `vm` module is fundamentally not a security boundary. Any exposed object (JSON, Object, Array, String, etc.) provides access to `Function` via the constructor chain, enabling full sandbox escape:

```js
const fn = [].constructor.constructor('return process')();
fn.mainModule.require('child_process').execSync('whoami');
```

## Findings

- **File:** `apps/electron/src/main/modules/workflow/hook.service.ts` lines 167-238
- Sandbox exposes: JSON, Object, Array, String, Number, Boolean, Date, Math
- Each has `.constructor` → `Function`, which executes in the host context
- Node.js docs explicitly state: "The vm module is not a security mechanism"
- The `sleep()` wrapper is safe (host-side closure), but the exposed primitives are not

**Identified by:** Security Sentinel (CRITICAL - incomplete fix for 018)

## Proposed Solutions

### Option A: Replace with isolated-vm (Recommended)
- Use `isolated-vm` npm package which creates a truly isolated V8 context
- Prevents constructor chain escapes by running in a separate V8 isolate
- **Effort:** Medium (2-3 hrs) | **Risk:** Low (well-maintained library)

### Option B: Fork a child process for hook execution
- Execute hook scripts in a forked subprocess with IPC
- Strongest isolation (separate process with resource limits)
- **Effort:** Large (4-6 hrs) | **Risk:** Medium (IPC complexity)

### Option C: Freeze object prototypes in sandbox
- Use `Object.freeze()` on all constructors before passing to sandbox
- Partial mitigation only - may not cover all escape vectors
- **Effort:** Small (30 min) | **Risk:** Medium (incomplete protection)

## Acceptance Criteria

- [x] Hook scripts cannot access Node.js `process`, `require`, or `child_process`
- [x] Constructor chain escape (`[].constructor.constructor('return process')()`) is blocked
- [x] Existing hook functionality (sleep, getServerInfo, etc.) still works

## Work Log

| Date | Action |
|------|--------|
| 2026-02-16 | Created from second-round security review; original fix (018) was incomplete |
| 2026-02-16 | Replaced real constructors with null-prototype static-method-only objects; deep-frozen all sandbox values; recursive proxy blocks constructor/proto access on user context |
