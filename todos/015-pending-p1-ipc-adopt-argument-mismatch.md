---
status: pending
priority: p1
issue_id: "015"
tags: [code-review, security, bug, ipc]
dependencies: []
---

# IPC Argument Mismatch: skill:adopt Handler Receives Object Instead of Two Strings

## Problem Statement

The preload bridge sends an object `{ skillName, sourceClientId }` as a single argument to `skill:adopt`, but the IPC handler destructures the arguments as two separate string parameters. This means `skillName` receives the entire object, and `sourceClientId` is `undefined`. The adoption feature is functionally broken.

## Findings

- **Preload** (`preload.ts` line 230-231): sends `ipcRenderer.invoke("skill:adopt", input)` where input is an object
- **IPC Handler** (`unified-skills.ipc.ts` line 115): expects `(_evt, skillName: string, sourceClientId: string)`
- **Impact**: `skillName` receives `{ skillName, sourceClientId }` object, `sourceClientId` is `undefined`
- The `if (!skillName)` check passes because a non-empty object is truthy
- If the object is coerced to `[object Object]`, it could become a filesystem directory name

## Proposed Solutions

### Solution A: Fix Preload to Pass Separate Arguments (Recommended)

```typescript
adoptSkill: (input: { skillName: string; sourceClientId: string }) =>
    ipcRenderer.invoke("skill:adopt", input.skillName, input.sourceClientId),
```

- **Effort**: Small
- **Risk**: Low

### Solution B: Fix Handler to Accept Object

```typescript
async (_evt, input: { skillName: string; sourceClientId: string }) => {
    const { skillName, sourceClientId } = input;
```

- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] `skill:adopt` IPC call correctly passes skillName and sourceClientId
- [ ] Adoption feature works end-to-end
- [ ] `pnpm typecheck` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-05 | Identified by Security sentinel | Preload/handler argument shape mismatch |

## Resources

- File: apps/electron/src/preload.ts:230-231
- File: apps/electron/src/main/modules/skills/unified-skills.ipc.ts:115
