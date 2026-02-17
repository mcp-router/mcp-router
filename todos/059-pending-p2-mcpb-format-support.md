---
status: pending
priority: p2
issue_id: "059"
tags: [strategic, feature, ecosystem]
dependencies: []
---

# Support .mcpb Desktop Extension Format

## Problem Statement

Anthropic open-sourced the `.mcpb` (MCP Bundle) format at v0.1 as the standard for portable MCP Desktop Extensions. It is designed explicitly for cross-app portability (not Claude-exclusive). MCP Router currently supports `.dxt` but not `.mcpb`. As .mcpb becomes the standard, MCP Router risks losing extension compatibility.

Claude Desktop's extension directory and one-click install workflow uses .mcpb bundles. VS Code is adding MCP Apps support. The .mcpb format includes built-in Node.js runtime, manifest.json, OS keychain secret storage, and auto-updates.

## Findings

- **.mcpb is open-sourced**: https://github.com/modelcontextprotocol/mcpb
- **Claude Desktop uses .mcpb**: Extension directory, one-click install, enterprise MDM management
- **MCP Router has .dxt support**: `dxt-processor.ts` and `dxt-converter.ts` handle DXT archives
- **Format relationship**: .mcpb is the successor/complement to .dxt -- both are zip archives with manifests
- **Enterprise value**: Claude Desktop Enterprise can pre-install .mcpb extensions via Group Policy/MDM
- **Security concern**: LayerX flagged RCE risks in Claude Desktop extensions -- MCP Router could add sandboxing

**Identified by:** IDE Researcher (MEDIUM)

## Proposed Solutions

### Option A: Add .mcpb import alongside .dxt (Recommended)
- Extend `dxt-processor.ts` to handle .mcpb manifest format
- Convert .mcpb manifest to MCP server config (similar to DXT flow)
- Support one-click .mcpb installation from file or URL
- **Effort:** Medium (1 week) | **Risk:** Low (similar to existing DXT support)

### Option B: Become a .mcpb runtime host
- Act as a Desktop Extension host alongside Claude Desktop
- Run .mcpb extensions with built-in Node.js runtime
- Enable MCP Router as a universal .mcpb runtime for any AI app
- **Effort:** Large (2-3 weeks) | **Risk:** Medium (runtime management complexity)

## Acceptance Criteria

- [ ] .mcpb files can be imported and installed as MCP servers
- [ ] .mcpb manifest is correctly parsed and converted to server config
- [ ] Extensions installed from .mcpb work identically to manually configured servers

## Work Log

| Date | Action |
|------|--------|
| 2026-02-17 | Created from IDE competitive analysis |
