---
status: pending
priority: p1
issue_id: "047"
tags: [strategic, architecture, competitive-gap]
dependencies: []
---

# Desktop-Only Architecture Limits Deployment Scenarios

## Problem Statement

MCP Router is architecturally bound to Electron desktop. SQLite for persistence, local filesystem for skills/symlinks, `better-sqlite3` synchronous API, and Electron-specific APIs (safeStorage, dialog, tray) make it impossible to deploy as:

- A headless server/daemon for teams or CI/CD
- A Docker container for infrastructure-as-code
- A web-only version for browser-based management
- A mobile companion

The CLI tool (`@mcp_router/cli serve`) exists as a thin standalone aggregator, but lacks the full feature set (no skills, no workflows, no tool catalog, no UI, no SystemServer).

## Findings

- **Competitors offering server/headless mode:** MetaMCP (Docker), MCPHub/samanhappy (Docker + web UI), Solo.io AgentGateway (Kubernetes), Cloudflare Workers (edge), Pipedream (cloud)
- **Market trend:** Enterprise MCP management is moving toward gateway patterns (centralized, always-on, team-accessible)
- **Current limitation:** The `RemotePlatformAPI` exists for remote workspace connectivity but doesn't enable a standalone server deployment
- **Key architectural blockers:** better-sqlite3 (native module), Electron safeStorage API, filesystem symlinks for skills, window/tray management

**Identified by:** Strategic Competitive Analysis + Architecture Analysis

## Proposed Solutions

### Option A: Headless daemon mode (Recommended first step)
- Extract core services into a standalone Node.js process (no Electron dependency)
- Reuse existing HTTP server + REST API endpoints
- Add a web admin dashboard (separate from Electron renderer)
- Run as `mcpr-server` daemon with systemd/launchd support
- **Effort:** Extra Large (4-6 weeks) | **Risk:** Medium (requires abstracting Electron-specific APIs)

### Option B: Docker-first server deployment
- Package headless mode into a Docker container
- Add docker-compose with PostgreSQL option (replacing SQLite)
- Helm chart for Kubernetes deployment
- **Effort:** Extra Large (6-8 weeks, after Option A) | **Risk:** Medium (database migration, config management)

### Option C: Keep desktop-only, enhance CLI
- Expand CLI to include all features (skills, workflows, tool catalog, SystemServer)
- CLI connects to desktop app's HTTP server for full functionality
- **Effort:** Large (2-3 weeks) | **Risk:** Low (no architectural change, but desktop dependency remains)

## Acceptance Criteria

- [ ] Core MCP aggregation can run without Electron process
- [ ] REST API provides full management capability
- [ ] Configuration can be file-based (no GUI dependency)
- [ ] Skills, workflows, and tool catalog work in headless mode

## Work Log

| Date | Action |
|------|--------|
| 2026-02-17 | Created from strategic competitive analysis review |
