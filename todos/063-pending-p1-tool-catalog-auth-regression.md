---
status: pending
priority: p1
issue_id: "063"
tags: [code-review, security, integration, mcp, auth]
dependencies: []
---

# Tool Catalog Meta-Tools Fail Without Token Metadata

Tool catalog meta-tools (`tool_discovery`, `tool_execute`, `tool_capabilities`) require a valid token in `_meta`, but the HTTP server now only injects `clientId`. This breaks catalog-mode clients over HTTP because `ToolCatalogHandler.requireValidToken()` receives `undefined` and rejects requests.

## Problem Statement

Catalog-mode MCP clients cannot use the meta-tools over HTTP, causing discovery and execution to fail even when authentication already succeeded at the HTTP middleware.

## Findings

- `MCPHttpServer.attachRequestMetadata()` now writes `_meta.clientId` and no longer writes `_meta.token`.
- `ToolCatalogHandler` still calls `requireValidToken()` based solely on `_meta.token`.
- Result: valid HTTP requests fail tool catalog operations with auth errors or invalid token handling.

**Locations:**
- `apps/electron/src/main/modules/mcp-server-runtime/http/mcp-http-server.ts`
- `apps/electron/src/main/modules/tool-catalog/tool-catalog-handler.ts`

## Proposed Solutions

### Option 1: Reintroduce token in `_meta` for router-only handlers

**Approach:** Include `_meta.token` alongside `_meta.clientId`, but ensure downstream server requests strip token before forwarding. Limit `_meta.token` use to router handlers (tool catalog, system tools).

**Pros:**
- Minimal code change
- Preserves existing validation flow

**Cons:**
- Risk of accidental token leakage to downstream servers if not carefully scoped

**Effort:** 1-2 hours

**Risk:** Medium

---

### Option 2: Allow clientId-authenticated requests to bypass token validation

**Approach:** Update `ToolCatalogHandler.requireValidToken()` to accept a trusted `clientId` from middleware (e.g., a `meta.authenticated` flag or a signed header) and skip token validation when present.

**Pros:**
- Eliminates token propagation
- Aligns with current “clientId only” metadata

**Cons:**
- Requires new trust boundary definition
- Risky if clientId can be spoofed outside HTTP middleware

**Effort:** 2-4 hours

**Risk:** Medium

---

### Option 3: Add a signed session identifier

**Approach:** Emit a signed/opaque session ID in `_meta` from the HTTP middleware and validate it in `ToolCatalogHandler` instead of tokens.

**Pros:**
- Stronger security than raw clientId
- Avoids token propagation

**Cons:**
- More involved changes across middleware + handler

**Effort:** 4-8 hours

**Risk:** Low-Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/mcp-server-runtime/http/mcp-http-server.ts`
- `apps/electron/src/main/modules/tool-catalog/tool-catalog-handler.ts`

**Related components:**
- Tool Catalog (meta-tools)
- TokenValidator

## Resources

- **Branch:** current `main` local changes

## Acceptance Criteria

- [ ] `tool_discovery`, `tool_execute`, and `tool_capabilities` succeed over HTTP with valid auth
- [ ] Downstream server requests do not receive raw tokens (if reintroduced)
- [ ] Unit/integration coverage for catalog auth path exists or is updated

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Codex

**Actions:**
- Verified `_meta.token` removal in HTTP metadata injection
- Confirmed tool catalog handlers require token
- Documented regression and options

**Learnings:**
- Catalog-mode clients depend on `_meta.token` for validation
- Removing token without alternate trust mechanism breaks meta-tools

