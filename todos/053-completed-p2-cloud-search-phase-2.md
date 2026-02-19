---
status: completed
priority: p2
issue_id: "053"
tags: [strategic, feature, tool-catalog]
dependencies: []
---

# Tool Catalog Cloud Search (Phase 2) Not Implemented

## Problem Statement

Phase 1 of the Tool Catalog (local MiniSearch with BM25 ranking) is complete and working. Phase 2 (cloud-powered LLM-based semantic search) is documented in `docs/design/tool-catalog-plan.md` but not implemented. Cloud search would significantly improve tool discovery for users with many servers (50+ tools), enabling natural language queries like "find me a tool that can send Slack messages" instead of keyword-based search.

## Findings

- **Current state:** Local MiniSearch with fuzzy matching and synonyms
- **Phase 2 design:** `CloudSearchProvider` with fallback to MiniSearch, cloud search API endpoint
- **Competitors:** Claude Code has "MCP Tool Search" with 95% context savings; Cursor has "dynamic context management" with 46.9% token reduction
- **MCP Router advantage:** Tool Catalog meta-tools (`tool_discovery`, `tool_execute`, `tool_capabilities`) are already unique -- cloud search would make them best-in-class
- **User need:** As users add more servers, tool discovery becomes exponentially harder without semantic understanding

**Identified by:** Strategic Competitive Analysis + Architecture Analysis

## Proposed Solutions

### Option A: LLM-powered search via API (Recommended)
- Implement `CloudSearchProvider` as designed in the plan doc
- Use Anthropic/OpenAI API for semantic tool matching
- Fallback to MiniSearch when offline or for fast queries
- **Effort:** Medium (1-2 weeks) | **Risk:** Low (design already exists, API integration straightforward)

### Option B: Local embedding-based semantic search
- Use a small local embedding model (e.g., all-MiniLM-L6-v2) for semantic search
- No cloud dependency, works offline
- **Effort:** Medium (1-2 weeks) | **Risk:** Medium (model size, memory usage in Electron)

## Acceptance Criteria

- [ ] Natural language queries return semantically relevant tools
- [ ] Cloud search falls back gracefully to local BM25
- [ ] Per-project `optimization` setting controls search provider (`bm25` vs `cloud`)
- [ ] Response latency under 2 seconds for cloud search

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
