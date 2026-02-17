---
status: complete
priority: p2
issue_id: "050"
tags: [strategic, security, enterprise]
dependencies: []
---

# No Rate Limiting, Throttling, or Cost Governance

## Problem Statement

MCP Router has zero rate limiting infrastructure. There is no request throttling, no per-client quotas, and no cost management. A misbehaving client could overwhelm backend servers with unlimited tool calls. There is no way to enforce fair usage across multiple clients or set spending limits for LLM-backed tools.

As the MCP gateway pattern matures, rate limiting and cost governance are becoming table-stakes features that differentiate enterprise solutions from developer tools.

## Findings

- **Competitors with rate limiting:** MetaMCP (pluggable middleware), Solo.io AgentGateway (enterprise gateway controls), Amazon Bedrock AgentCore (fine-grained interceptors), LiteLLM (tool-level permission filtering)
- **Current state:** Only search result for "rate limit" in the codebase is a UI placeholder text for a hook module name
- **Workflow hooks can approximate this** but are JavaScript-in-VM, per-workflow, and cannot enforce global limits
- **Market trend:** MCP gateways mirror the API gateway evolution of the 2010s -- rate limiting, circuit breakers, and cost controls are standard features

**Identified by:** Strategic Competitive Analysis

## Proposed Solutions

### Option A: Built-in rate limiter (Recommended)
- Token bucket or sliding window rate limiting per client, per server, per tool
- Configurable limits in settings (requests/minute, requests/hour)
- Rate limit headers in HTTP responses
- Admin UI for monitoring and configuration
- **Effort:** Medium (1-2 weeks) | **Risk:** Low (well-understood pattern)

### Option B: Middleware/hook-based rate limiting
- Extend workflow hook system with built-in rate limiting node type
- Leverage existing hook infrastructure
- **Effort:** Small (3-5 days) | **Risk:** Low (limited to workflow-enabled paths)

## Acceptance Criteria

- [ ] Per-client request rate limits can be configured
- [ ] Per-server and per-tool limits can be set independently
- [ ] Rate limit violations return appropriate MCP error codes
- [ ] Usage metrics are visible in the UI

## Work Log

| Date | Action |
|------|--------|
| 2026-02-17 | Created from strategic competitive analysis review |
