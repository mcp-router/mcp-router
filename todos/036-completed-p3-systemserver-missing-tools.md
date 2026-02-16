---
status: completed
priority: p3
issue_id: "036"
tags: [code-review, agent-native]
dependencies: []
---

# Missing SystemServer Tools for Full Agent Parity

## Problem Statement

The SystemServer has 6 tools but the UI exposes ~50 capabilities. Key missing tools include start/stop server, update server config, workspace management, skills management, settings management, workflow management, and log viewing. Current agent-native parity is ~12%.

## Findings

**Missing P0 tools:**
- `router_start_server` / `router_stop_server` -- most critical lifecycle actions
- `router_update_server` -- edit server config (env, project, auto-start)

**Missing P1 tools:**
- `router_get_settings` / `router_update_settings` -- especially `toolCatalogEnabled`, `prefixToolNames`
- `router_list_workspaces` / `router_switch_workspace`

**Missing P2 tools:**
- Skills CRUD, workflow CRUD, project CRUD, client app management, log viewing

**Identified by:** Agent-Native Reviewer (full capability map with 37 entries)

## Proposed Solutions

Implement in phases, starting with P0 tools after transport binding (todo 022) is resolved.
- **Effort:** Large (multi-session) | **Risk:** Low per tool

## Acceptance Criteria

- [ ] Start/stop server tools implemented
- [ ] Update server config tool implemented
- [ ] Settings management tools implemented

## Work Log

| Date | Action |
|------|--------|
| 2026-02-16 | Created from multi-agent code review |
| 2026-02-16 | Fixed by parallel resolve agents |
