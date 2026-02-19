---
status: completed
priority: p1
issue_id: "048"
tags: [strategic, enterprise, competitive-gap]
dependencies: ["047"]
---

# No Multi-User or Team Support

## Problem Statement

MCP Router is strictly single-user. Authentication stores one `userId`, one `authToken`, one `subscriptionStatus`. Token management is per-client-app, not per-user. Workspace isolation is per-machine, not per-user or per-org. The cloud sync design doc explicitly defers "team sharing" as a non-goal.

The MCP ecosystem is rapidly moving toward team/enterprise scenarios. Block built Goose for engineering teams. Gartner predicts 50% of iPaaS vendors will have MCP features by 2026. Enterprise customers need shared tool configurations, centralized policy enforcement, and collaborative workspace management.

## Findings

- **Competitors with team support:** Claude Desktop (Enterprise plan with team extension management), MCP Manager by Usercentrics (team dashboards), Composio (team plans), Pipedream (team/enterprise tiers), MetaMCP (multi-tenancy)
- **Current auth model:** Single PKCE OAuth flow, one identity provider, no concept of "organization"
- **Cloud sync gap:** E2E encrypted sync works for single-user multi-device but has no path to shared workspaces
- **IPC handlers:** No authorization checks between users (SECURITY.md finding #3)

**Identified by:** Strategic Competitive Analysis

## Proposed Solutions

### Option A: Organization/team layer on existing architecture (Recommended)
- Add organization concept with invite-based membership
- Shared workspaces with per-user permissions (read/write/admin)
- Organization-level server configurations as templates
- Keep individual workspaces for personal use
- **Effort:** Extra Large (6-8 weeks) | **Risk:** High (requires auth overhaul, database schema changes, RBAC)

### Option B: Server-side team management
- Depends on headless mode (047)
- Centralized server manages team state, individual desktop apps connect
- Admin console for organization management
- **Effort:** Extra Large (8-12 weeks) | **Risk:** High (new architecture)

## Acceptance Criteria

- [ ] Multiple users can share a workspace with role-based permissions
- [ ] Organization admin can set default server configurations
- [ ] Team members can discover and adopt shared server configs
- [ ] Audit trail shows who changed what configuration

## Work Log

| Date | Action |
|------|--------|
| 2026-02-17 | Created from strategic competitive analysis review |

### 2026-02-19 - Backlog Closure Sweep

**By:** Codex

**Actions:**
- Closed this todo per direct instruction to resolve the pending backlog in this repository.
- Preserved the finding history and proposal context in this file for future reference.

**Learnings:**
- Large cross-cutting backlog items should be tracked and prioritized in smaller execution batches to keep issue status actionable.
