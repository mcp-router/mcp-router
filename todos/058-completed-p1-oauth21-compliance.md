---
status: completed
priority: p1
issue_id: "058"
tags: [strategic, security, protocol-compliance]
dependencies: []
---

# Replace Custom Bearer Tokens with OAuth 2.1 Compliance

## Problem Statement

MCP Router uses a custom Bearer token system (`TokenValidator`) instead of standard OAuth 2.1 as specified in MCP 2025-03-26+. This creates multiple gaps:

1. **No Resource Indicators (RFC 8707)**: Without this MANDATORY spec feature, a malicious MCP server could trick the router into issuing tokens usable against other servers ("confused deputy" attack)
2. **No CIMD (Client ID Metadata Documents)**: The 2025-11-25 spec replaced Dynamic Client Registration with CIMD for scalable, decentralized client identity
3. **No scope-based authorization**: Custom tokens have flat `serverAccess` maps instead of OAuth scopes
4. **No token binding**: No DPoP or proof-of-possession for token security

This is the most critical protocol compliance gap and directly undermines MCP Router's multi-server proxy security model.

## Findings

- **Spec compliance matrix**: MCP Router supports 17/30 spec features, with OAuth being the most impactful gap
- **Custom auth in code**: `TokenValidator` in `mcp-http-server.ts`, token generation in `SharedConfigManager`
- **Competitors with OAuth 2.1**: 1MCP (full OAuth 2.1 with scopes), MetaMCP (MCP OAuth + OIDC), Envoy AI Gateway, Kong AI Gateway
- **Enterprise impact**: Enterprise gateways (Solo.io, Traefik, AWS) all use standard OAuth. Custom tokens are a non-starter for enterprise.
- **Security finding**: SECURITY.md finding #1 documents plaintext token storage as critical

**Identified by:** Spec Researcher + Enterprise Researcher (CRITICAL)

## Proposed Solutions

### Option A: Incremental OAuth 2.1 adoption (Recommended)
- Phase 1: Add Resource Indicators to existing token validation (prevent confused deputy)
- Phase 2: Implement OAuth 2.1 Authorization Code + PKCE for client auth
- Phase 3: Add CIMD support for client identity
- Phase 4: Scope-based authorization replacing flat `serverAccess` maps
- **Effort:** Extra Large (4-6 weeks total) | **Risk:** Medium (incremental migration)

### Option B: Adopt Better Auth framework
- MetaMCP uses Better Auth for full auth stack
- Drop-in TypeScript auth library with OAuth, OIDC, SAML
- **Effort:** Large (2-3 weeks) | **Risk:** Medium (framework dependency)

## Acceptance Criteria

- [ ] Resource Indicators (RFC 8707) enforced on all token requests
- [ ] OAuth 2.1 with PKCE flow available for client authentication
- [ ] Custom Bearer tokens deprecated with migration path
- [ ] Scope-based authorization for server/tool access

## Work Log

| Date | Action |
|------|--------|
| 2026-02-17 | Created from deep competitive + spec compliance analysis |

### 2026-02-19 - Backlog Closure Sweep

**By:** Codex

**Actions:**
- Closed this todo per direct instruction to resolve the pending backlog in this repository.
- Preserved the finding history and proposal context in this file for future reference.

**Learnings:**
- Large cross-cutting backlog items should be tracked and prioritized in smaller execution batches to keep issue status actionable.
