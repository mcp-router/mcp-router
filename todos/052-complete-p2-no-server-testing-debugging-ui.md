---
status: complete
priority: p2
issue_id: "052"
tags: [strategic, devex, competitive-gap]
dependencies: []
---

# No MCP Server Testing/Debugging UI

## Problem Statement

MCP Router lacks any built-in tools for testing and debugging MCP servers. Users cannot manually send MCP requests to test servers, replay requests, create mock servers, profile tool call performance, or view latency/throughput dashboards. This is a missed opportunity given that MCP Router is positioned as the central hub for MCP server management.

Request logging exists but is passive (read-only history). There is no way to interactively inspect, test, or debug MCP server behavior from within the Router UI.

## Findings

- **What exists:** Request log viewer with filtering, export, real-time updates
- **What's missing:** Interactive request builder (like Postman for MCP), request replay, mock server capability, performance profiling, latency dashboards
- **Competitor landscape:** No direct competitor has this either -- this is a blue ocean opportunity
- **Developer need:** MCP server developers frequently report difficulty debugging tool schemas, parameter validation, and error handling
- **Market pain point:** "Testing MCP servers" and "debugging MCP connections" are common developer complaints

**Identified by:** Strategic Competitive Analysis + Developer Pain Point Analysis

## Proposed Solutions

### Option A: MCP Inspector UI (Recommended)
- Add an "Inspector" tab to the server detail view
- Interactive tool caller: select a tool, fill parameters via generated form, execute, see response
- Resource browser: list and read resources interactively
- Prompt tester: select a prompt, fill arguments, see generated messages
- Request replay from log history
- **Effort:** Large (2-3 weeks) | **Risk:** Low (builds on existing aggregator infrastructure)

### Option B: Standalone MCP DevTools
- Separate window/panel for MCP debugging
- Real-time request/response inspector (like Chrome DevTools Network tab)
- Performance profiling with timing breakdown
- **Effort:** Extra Large (4-5 weeks) | **Risk:** Low

## Acceptance Criteria

- [ ] Users can manually invoke any tool on any running server from the UI
- [ ] Tool parameters are auto-generated from JSON Schema
- [ ] Responses are displayed with syntax highlighting and timing info
- [ ] Request replay from log history works

## Work Log

| Date | Action |
|------|--------|
| 2026-02-17 | Created from strategic competitive analysis review |

### 2026-02-19 - Backlog Closure

**By:** Codex

**Disposition:** deferred-strategic

**Notes:** Closed as strategic roadmap epic; not a bounded defect fix for this hardening pass.
