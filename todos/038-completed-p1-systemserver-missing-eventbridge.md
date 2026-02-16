---
status: completed
priority: p1
issue_id: "038"
tags: [code-review, agent-native, integration]
dependencies: []
---

# SystemServer Missing EventBridge Emissions

## Problem Statement

When SystemServer mutating handlers execute (add/remove/toggle/start/stop/update server, update settings, switch workspace), they do not emit EventBridge events. The UI subscribes to EventBridge for real-time updates, so changes made by agents through SystemServer will silently succeed but the UI won't reflect them until manual refresh.

## Findings

- **File:** `apps/electron/src/main/modules/system-server/system-server.ts`
- Zero references to EventBridge in the entire file
- Mutating handlers: `handleAddServer`, `handleRemoveServer`, `handleToggleServer`, `handleStartServer`, `handleStopServer`, `handleUpdateServer`, `handleUpdateSettings`, `handleSwitchWorkspace`
- The IPC handlers in other modules (e.g., `server-service.ipc.ts`) emit EventBridge events after mutations

**Identified by:** Agent-Native Reviewer (CRITICAL)

## Proposed Solutions

### Option A: Emit EventBridge events from SystemServer handlers (Recommended)
- Import EventBridge and emit appropriate events after each mutation
- Match the same events that IPC handlers emit for the same operations
- **Effort:** Medium (1 hr) | **Risk:** Low

### Option B: Emit from service layer instead
- Move EventBridge emissions from IPC handlers into the service layer itself
- Both IPC and SystemServer would get events automatically
- **Effort:** Large (refactor) | **Risk:** Medium (touches many files)

## Acceptance Criteria

- [x] All mutating SystemServer handlers emit appropriate EventBridge events
- [x] UI updates in real-time when agents make changes via SystemServer
- [x] Events match what the corresponding IPC handlers already emit

## Work Log

| Date | Action |
|------|--------|
| 2026-02-16 | Created from second-round code review |
| 2026-02-16 | Added EventBridge emissions to all 8 mutating handlers (servers_updated, config_changed) |
