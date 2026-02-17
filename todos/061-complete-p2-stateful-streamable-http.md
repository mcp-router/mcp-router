---
status: complete
priority: p2
issue_id: "061"
tags: [strategic, protocol-compliance, architecture]
dependencies: []
---

# Add Stateful Streamable HTTP Session Support

## Problem Statement

MCP Router currently only supports **stateless** Streamable HTTP mode (`sessionIdGenerator: undefined` in `aggregator-server.ts`). This means each request creates a fresh transport with no session persistence. The MCP spec supports stateful sessions via `MCP-Session-Id` headers, which enables:

- Task tracking across requests (required for Tasks primitive)
- Sampling request routing back to the correct client
- Elicitation state persistence
- Resource subscription management

Without stateful sessions, implementing Tasks (046) and Sampling (045) becomes significantly harder since there's no way to correlate async responses with the originating client session.

## Findings

- **Current code**: `aggregator-server.ts:78` creates `StreamableHTTPServerTransport` in stateless mode
- **Spec support**: `MCP-Session-Id` header for session management, stream resumability with event IDs
- **Dependency**: Tasks primitive and Sampling both require session affinity to route async responses
- **Competitors**: Enterprise gateways (Solo.io, Traefik) emphasize "session-smart routing" as critical for MCP
- **SDK support**: `@modelcontextprotocol/sdk` v1.25.2 supports both stateful and stateless modes

**Identified by:** Spec Researcher (HIGH)

## Proposed Solutions

### Option A: Add stateful session support alongside stateless (Recommended)
- Enable `sessionIdGenerator` in `StreamableHTTPServerTransport`
- Maintain session-to-client mapping for routing async responses
- Keep stateless mode as fallback for simple proxy scenarios
- **Effort:** Medium (1 week) | **Risk:** Low (SDK already supports this)

## Acceptance Criteria

- [ ] Stateful sessions supported via `MCP-Session-Id` header
- [ ] Session-to-client mapping maintained for async response routing
- [ ] Stateless mode still available as default/fallback
- [ ] Sessions have configurable TTL and cleanup

## Work Log

| Date | Action |
|------|--------|
| 2026-02-17 | Created from spec compliance analysis |
