---
status: completed
priority: p2
issue_id: "049"
tags: [strategic, enterprise, security]
dependencies: ["048"]
---

# No RBAC, SSO/SAML, or Enterprise Auth

## Problem Statement

MCP Router has tool-level permissions (enable/disable per tool per server) but no user-level permission model. There is no RBAC, no SSO/SAML/OIDC integration, and no enterprise identity provider configuration. The token system has `serverAccess` (which servers a token can reach) but no role/scope concept. IPC handlers have no authorization checks.

For any team or enterprise deployment, this is a blocker. Regulated industries require SSO, audit-grade access control, and compliance-ready identity management.

## Findings

- **Competitors with enterprise auth:** MCP Manager by Usercentrics (SAML/OIDC), MetaMCP (OpenID Connect), Composio (enterprise SSO), Docker MCP (Docker Business SSO)
- **MCP spec support:** OAuth 2.1 formalized, step-up authorization in 2025-11-25 spec
- **Current state:** PKCE OAuth flow with single identity provider. No SAML. No OIDC discovery
- **Market trend:** Enterprise MCP gateways (Peta MCP Suite, Amazon Bedrock AgentCore) emphasize zero-trust, fine-grained authorization as a primary differentiator

**Identified by:** Strategic Competitive Analysis

## Proposed Solutions

### Option A: Incremental RBAC + SSO (Recommended)
- Phase 1: Add role-based access control (viewer/editor/admin) to workspace permissions
- Phase 2: OIDC/SAML SSO integration for enterprise identity providers
- Phase 3: Fine-grained tool-level permissions per user/role
- **Effort:** Extra Large (8-10 weeks total) | **Risk:** Medium (well-understood patterns)

### Option B: Delegate to external identity provider
- Integrate with Cerbos, Auth0, or similar for policy decisions
- Router checks authorization on every tool call
- **Effort:** Large (3-4 weeks) | **Risk:** Low (external service dependency)

## Acceptance Criteria

- [ ] Roles (viewer, editor, admin) can be assigned per workspace
- [ ] SSO login via OIDC/SAML for enterprise identity providers
- [ ] Tool-level access control respects user roles
- [ ] Authentication integrates with existing PKCE OAuth flow

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
