---
status: complete
priority: p3
issue_id: "057"
tags: [strategic, devex, feature]
dependencies: []
---

# No Auto-Discovery of MCP Servers

## Problem Statement

MCP Router requires manual server addition (config form, DXT import, or marketplace install). There is no automatic detection of MCP servers from:

- Local network (mDNS/DNS-SD for MCP servers on LAN)
- Project manifests (`package.json`, `.mcprc`, `.mcp.json`, or similar)
- Running processes (detect MCP servers already running locally)
- Workspace files (`.vscode/mcp.json`, `.cursor/mcp.json`)

As the MCP ecosystem grows and project-level MCP configurations become standard, auto-discovery would significantly reduce setup friction.

## Findings

- **Current discovery:** Marketplace integration (official MCP Registry, Skills Registry), manual addition
- **Competitors:** MCP Manager/amxv (auto-scan IDE configs), Docker MCP (Dynamic MCP for on-demand discovery), LobeHub (MCPfinder for AI-driven discovery)
- **MCP spec direction:** The official MCP Registry is adding standardized `server.json` metadata format
- **Developer pain point:** "Setting up MCP servers is tedious" is a common complaint

**Identified by:** Strategic Competitive Analysis

## Proposed Solutions

### Option A: Project config auto-detection (Recommended)
- Scan workspace directories for `.mcp.json`, `.vscode/mcp.json`, `.cursor/mcp.json`
- Prompt user to add discovered servers
- Watch for new config files and notify
- **Effort:** Medium (1 week) | **Risk:** Low (file watching already exists via chokidar)

### Option B: IDE config import
- Scan installed IDE configs (Claude Desktop, Cursor, VS Code, etc.)
- Import existing MCP server configurations from other tools
- **Effort:** Small (3-5 days) | **Risk:** Low (config paths are well-known)

## Acceptance Criteria

- [ ] MCP server configs from project directories are auto-detected
- [ ] User is prompted before adding discovered servers
- [ ] IDE config scanning finds servers from other MCP clients
- [ ] File watcher detects new configs in real-time

## Work Log

| Date | Action |
|------|--------|
| 2026-02-17 | Created from strategic competitive analysis review |
