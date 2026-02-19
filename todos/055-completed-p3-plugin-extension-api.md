---
status: completed
priority: p3
issue_id: "055"
tags: [strategic, architecture, devex]
dependencies: []
---

# No Plugin/Extension API for Community Contributions

## Problem Statement

MCP Router has no formal plugin or extension API. The workflow hook system provides JavaScript-in-VM hooks, but there is no way for the community to contribute custom node types, UI extensions, or integration modules. The Workflow Phase 2 roadmap mentions "Plugin system for custom node types" as future work.

This limits MCP Router's ability to grow through community contributions and reduces its potential as a platform.

## Findings

- **Current extensibility:** Workflow hooks (JavaScript in VM sandbox), Skills (markdown files for agent instruction)
- **What's missing:** Plugin API, extension marketplace, third-party UI extensions, custom workflow node types
- **Competitors:** LobeChat (open source plugin marketplace), Docker MCP (Dynamic MCP for on-demand composition), VS Code/Cursor (extension ecosystem)
- **Market trend:** Successful developer tools build ecosystems around extensibility (VS Code extensions, Figma plugins, Raycast extensions)

**Identified by:** Strategic Competitive Analysis

## Proposed Solutions

### Option A: Workflow plugin API first (Recommended)
- Define a plugin interface for custom workflow node types
- Plugins are npm packages with a manifest
- Hot-loadable at runtime
- Start with workflow nodes, expand to UI panels later
- **Effort:** Large (3-4 weeks) | **Risk:** Medium (API design needs to be stable)

### Option B: Full extension framework
- VS Code-style extension API with contribution points
- Extension marketplace with publishing/discovery
- UI extension panels, custom settings, menu items
- **Effort:** Extra Large (8-12 weeks) | **Risk:** High (large API surface, maintenance burden)

## Acceptance Criteria

- [ ] Third-party workflow node types can be loaded from npm packages
- [ ] Plugin manifest defines capabilities, configuration, and UI
- [ ] Plugins are sandboxed and cannot access core internals directly
- [ ] At least one example plugin demonstrates the API

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
