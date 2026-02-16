---
status: pending
priority: p1
issue_id: "001"
tags: [agent-native, architecture, mcp]
dependencies: []
---

# Agent-Native Router Management

## Problem Statement

The MCP Router application violates the **Action Parity** principle. While users can add, remove, and connect servers via the UI, agents (including Claude) have no way to perform these actions programmatically. There is no internal "System" MCP server exposing these capabilities as tools.

## Findings

- **Missing Tools**: No tools exposed for `add_server`, `remove_server`, `connect_remote_server`.
- **Orphan UI**: `Manual.tsx` contains logic for adding servers that is inaccessible to agents.
- **Impact**: An agent cannot "configure the router" or "connect to GitHub" without human intervention in the UI.

## Proposed Solutions

### Solution A: Internal System MCP Server (Recommended)

Create a `SystemServer` class that implements `MCPServer` interface but wraps the internal `MCPServerManager`.

- **Pros**: consistent with MCP architecture, easy to expose to agents.
- **Cons**: Requires mapping internal types to MCP tool schemas.

### Solution B: HTTP API

Expose an HTTP API for router management.

- **Pros**: Decoupled.
- **Cons**: Requires agent to know how to call HTTP endpoints (less native than MCP tools).

## Acceptance Criteria

- [ ] Create `SystemServer` module in `apps/electron/src/main/modules/system-server`.
- [ ] Implement `add_server`, `remove_server`, `list_servers` tools.
- [ ] Register `SystemServer` in `MCPServerManager` so it's always available.
- [ ] Verify agent can add a new server using a tool call.

## Work Log

- 2026-02-03: Initial finding during Agent-Native Review.
