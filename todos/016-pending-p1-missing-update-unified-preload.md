---
status: pending
priority: p1
issue_id: "016"
tags: [code-review, security, bug, ipc]
dependencies: []
---

# Missing updateUnifiedSkill Preload Binding

## Problem Statement

The renderer platform API calls `window.electronAPI.updateUnifiedSkill(id, updates)`, but there is no corresponding preload binding in `preload.ts`. The `global.d.ts` type declaration also does not include it. The unified skill update feature is broken at runtime.

## Findings

- **Renderer call** (`electron-platform-api.ts` line 264): calls `window.electronAPI.updateUnifiedSkill(id, updates)`
- **Preload** (`preload.ts`): No `updateUnifiedSkill` binding exists
- **global.d.ts**: No `updateUnifiedSkill` type declaration
- **IPC handler** (`unified-skills.ipc.ts`): Has a `skill:update-unified` handler registered
- **Impact**: Runtime error `window.electronAPI.updateUnifiedSkill is not a function`

## Proposed Solutions

### Solution A: Add Missing Preload Binding (Recommended)

Add to `preload.ts`:
```typescript
updateUnifiedSkill: (id: string, updates: { name?: string; content?: string; globalSync?: boolean }) =>
    ipcRenderer.invoke("skill:update-unified", id, updates),
```

And add corresponding type in `global.d.ts`.

- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] `updateUnifiedSkill` binding exists in preload.ts
- [ ] Corresponding type declaration in global.d.ts
- [ ] Unified skill updates work end-to-end from renderer
- [ ] `pnpm typecheck` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-05 | Identified by Security sentinel | Missing IPC bridge binding |

## Resources

- File: apps/electron/src/preload.ts (missing binding)
- File: apps/electron/src/renderer/platform-api/electron-platform-api.ts:264
- File: apps/electron/src/main/modules/skills/unified-skills.ipc.ts (handler exists)
