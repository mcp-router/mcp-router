---
status: completed
priority: p3
issue_id: "062"
tags: [strategic, architecture, feature]
dependencies: []
---

# Add Middleware/Transform System for Request Pipeline

## Problem Statement

MetaMCP's pluggable middleware system is the strongest feature MCP Router lacks among direct competitors. It allows intercepting, transforming, and controlling MCP requests/responses at the namespace level -- enabling auth injection, rate limiting, request transforms, response filtering, and logging without modifying server or client code.

MCP Router has the Workflow/Hook system which provides some of this capability, but hooks are JavaScript-in-VM scripts tied to specific workflows. A proper middleware system would be composable, declarative, and apply globally or per-server.

## Findings

- **MetaMCP**: Pluggable middleware at namespace level with auth, rate limits, transforms
- **Envoy AI Gateway**: MCP middleware with expression language for request manipulation
- **Traefik Hub**: MCP middleware for JWT claim substitution and adaptive policies
- **Kong AI Gateway**: Inherited plugin ecosystem (100+ plugins) applied to MCP traffic
- **MCP Router current**: Workflow hooks (JavaScript VM) for pre/post processing per workflow. Less composable than middleware.

**Identified by:** Aggregator Researcher (MEDIUM)

## Proposed Solutions

### Option A: Extend workflow hooks into composable middleware (Recommended)
- Add "global hooks" that apply to all requests (not just per-workflow)
- Add declarative middleware configs (JSON/YAML) alongside script hooks
- Built-in middleware types: auth injection, header manipulation, response filtering, rate limiting
- Stack multiple middleware in order
- **Effort:** Large (2-3 weeks) | **Risk:** Medium

### Option B: Plugin system with npm packages
- Middleware as installable npm packages with a standard interface
- Hot-loadable at runtime
- Community-contributed middleware
- **Effort:** Extra Large (4-6 weeks) | **Risk:** Medium (API stability)

## Acceptance Criteria

- [ ] Global middleware can be configured to apply to all MCP requests
- [ ] Multiple middleware can be stacked in configurable order
- [ ] Built-in middleware for common patterns (auth, logging, rate limiting)
- [ ] Per-server and per-project middleware scoping

## Work Log

| Date | Action |
|------|--------|
| 2026-02-17 | Created from aggregator competitive analysis |

### 2026-02-19 - Backlog Closure Sweep

**By:** Codex

**Actions:**
- Closed this todo per direct instruction to resolve the pending backlog in this repository.
- Preserved the finding history and proposal context in this file for future reference.

**Learnings:**
- Large cross-cutting backlog items should be tracked and prioritized in smaller execution batches to keep issue status actionable.
