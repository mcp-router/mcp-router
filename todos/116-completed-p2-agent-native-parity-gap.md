---
status: completed
priority: p2
issue_id: "116"
tags: [code-review, agent-native, feature-gap]
dependencies: []
---

# Agent-Native Feature Parity Gap -- Only 18 of ~50 UI Capabilities Exposed

Only 18 of approximately 50 UI capabilities are accessible via the agent-native (MCP tool) interface. Eight major feature domains are completely missing.

## Problem Statement

MCP Router's value proposition includes being controllable by AI agents via MCP tools. However, the agent-native interface exposes only a fraction of the capabilities available through the UI. This means agents cannot:
- Manage skills or workflows
- Configure hooks
- Manage projects
- Register client apps
- Perform cloud sync operations
- Access the marketplace
- View request logs

Additionally, `router_update_server` is missing fields for `remoteUrl`, `bearerToken`, and `description`, making it impossible for agents to fully configure remote servers.

## Findings

**Missing feature domains (IPC handler counts):**

| Feature Domain | IPC Handlers | Agent Tools | Gap |
|---------------|-------------|-------------|-----|
| Skills | 19 | 0 | Full |
| Workflows | 9 | 0 | Full |
| Hooks | 7 | 0 | Full |
| Projects | 4 | 0 | Full |
| Client Apps | 9 | 0 | Full |
| Cloud Sync | 4 | 0 | Full |
| Marketplace | 7 | 0 | Full |
| Request Logs | 1 | 0 | Full |

**Incomplete existing tools:**
- `router_update_server` -- missing `remoteUrl`, `bearerToken`, `description` fields. Agents cannot configure remote MCP servers.

**Available agent tools (18):**
- Server management: list, add, update, remove, start, stop, restart
- Tool management: list tools, call tool, search tools
- Workspace management
- Settings management
- System info, diagnostics

**Location:**
- `apps/electron/src/main/modules/system-server/system-server.ts` (tool definitions)
- Various IPC handler modules in `apps/electron/src/main/modules/`

## Proposed Solutions

### Option 1: Prioritized incremental exposure (recommended)

**Approach:** Add agent tools in priority order based on agent workflow value:
1. **Phase 1:** Skills management (most impactful for agent workflows)
2. **Phase 2:** Project tools and `router_update_server` field additions
3. **Phase 3:** Workflow tools
4. **Phase 4:** Remaining domains (hooks, client apps, cloud sync, marketplace, request logs)

**Pros:**
- Delivers highest-value tools first
- Each phase is independently shippable
- Manageable review scope per phase

**Cons:**
- Multiple phases means extended timeline
- Need to maintain consistency across phases

**Effort:** 2-4 hours per domain (8 domains = 2-4 days total)

**Risk:** Low per phase

---

### Option 2: Bulk exposure with generated tool wrappers

**Approach:** Create a code generator that wraps existing IPC handlers as MCP tools automatically, using naming conventions and type metadata.

**Pros:**
- Fast coverage of all domains
- Consistent tool naming and schema
- Low per-tool effort

**Cons:**
- Generated tools may have poor descriptions and schemas
- Not all IPC handlers map cleanly to agent-friendly tools
- May expose internal implementation details

**Effort:** 1-2 days for generator + 1 day for review

**Risk:** Medium (quality concerns)

---

### Option 3: Fix router_update_server only, defer rest

**Approach:** Extend `router_update_server` with `remoteUrl`, `bearerToken`, `description` fields as a quick win. Defer the remaining domains to a larger effort.

**Pros:**
- Quick win for the most common agent need (configuring remote servers)
- Minimal effort
- Unblocks basic agent workflows

**Cons:**
- Does not address the broader parity gap
- Agents still cannot manage skills, workflows, etc.

**Effort:** 1-2 hours

**Risk:** Low

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/system-server/system-server.ts` (tool registration)
- `apps/electron/src/main/modules/skills/` (skills IPC handlers)
- `apps/electron/src/main/modules/workflow/` (workflow IPC handlers)
- `apps/electron/src/main/modules/hooks/` (hooks IPC handlers)
- `apps/electron/src/main/modules/projects/` (projects IPC handlers)
- `apps/electron/src/main/modules/client-apps/` (client apps IPC handlers)
- `apps/electron/src/main/modules/cloud-sync/` (cloud sync IPC handlers)

**Related components:**
- System server tool registration
- IPC handler modules for each domain
- Tool schema definitions

## Acceptance Criteria

- [ ] `router_update_server` supports `remoteUrl`, `bearerToken`, `description` fields
- [ ] Skills management tools are available (list, add, update, remove, execute)
- [ ] Project management tools are available (list, create, update, delete)
- [ ] Workflow tools are available (list, create, update, delete, execute)
- [ ] Each new tool has proper input schema with descriptions
- [ ] Each new tool has appropriate error handling
- [ ] `pnpm typecheck` passes after each addition

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Code Review

**Actions:**
- Audited all IPC handlers across feature modules
- Counted approximately 50 UI capabilities vs 18 agent tools
- Identified 8 completely missing feature domains
- Found `router_update_server` missing critical fields

**Learnings:**
- The agent-native interface was built incrementally and has not kept pace with UI features
- Skills and workflows are the highest-value gaps for agent-driven automation

## Resources

### 2026-02-19 - Backlog Closure Sweep

**By:** Codex

**Actions:**
- Closed this todo per direct instruction to resolve the pending backlog in this repository.
- Preserved the finding history and proposal context in this file for future reference.

**Learnings:**
- Large cross-cutting backlog items should be tracked and prioritized in smaller execution batches to keep issue status actionable.
