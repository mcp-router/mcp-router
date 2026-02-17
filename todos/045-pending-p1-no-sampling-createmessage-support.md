---
status: pending
priority: p1
issue_id: "045"
tags: [strategic, protocol, competitive-gap]
dependencies: []
---

# No Sampling/CreateMessage Support

## Problem Statement

MCP Router does not implement the `sampling/createMessage` capability from the MCP spec. This means MCP servers cannot request the client's LLM to generate text on their behalf -- blocking the entire "agentic MCP server" use case. As the ecosystem matures and more servers adopt sampling (e.g., code review servers that analyze diffs via LLM, workflow automation servers), MCP Router users will hit a wall.

The feature is explicitly documented as deferred in `docs/adr/MCP_DEFERRED_FEATURES.md` with HIGH impact rating.

## Findings

- **Competitors with this:** Claude Desktop (native), Cursor (native), ChatGPT Desktop (native)
- **Why it matters:** Sampling enables recursive agent patterns, server-side intelligence, and multi-step reasoning -- the core of agentic AI workflows
- **MCP Router challenge:** As a proxy (not an LLM client), implementing this requires either:
  1. Forwarding sampling requests to the actual upstream client (complex session routing)
  2. Calling LLMs directly (architectural shift, API key management, cost)
- **Market trend:** Sampling is increasingly required as servers become more autonomous

**Identified by:** Strategic Competitive Analysis

## Proposed Solutions

### Option A: Proxy sampling requests to upstream client (Recommended)
- When a backend server sends `sampling/createMessage`, route it upstream to the connected AI client
- The client (Claude Desktop, Cursor, etc.) processes the sampling request via its own LLM
- Router acts as a transparent proxy for sampling
- **Effort:** Large (1-2 weeks) | **Risk:** Medium (requires bidirectional request routing, client capability negotiation)

### Option B: Built-in LLM integration
- Add direct LLM API integration (Anthropic, OpenAI, etc.) with user-provided API keys
- MCP Router handles sampling requests internally
- **Effort:** Extra Large (3-4 weeks) | **Risk:** High (architectural shift, API key management, cost implications, model selection UX)

### Option C: Hybrid approach
- Proxy sampling to upstream client when available
- Fall back to built-in LLM integration when client doesn't support sampling
- **Effort:** Extra Large (4-5 weeks) | **Risk:** Medium (combines both approaches)

## Acceptance Criteria

- [ ] MCP servers can send `sampling/createMessage` requests through the router
- [ ] Sampling requests are correctly routed to the appropriate handler
- [ ] Capability negotiation advertises sampling support to backend servers
- [ ] Rate limiting/approval UX for sampling requests (human-in-the-loop option)

## Work Log

| Date | Action |
|------|--------|
| 2026-02-17 | Created from strategic competitive analysis review |
