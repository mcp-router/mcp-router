# MCP Deferred Features (Revisit Q2 2026)

> **Status:** Deferred
> **Date:** 2026-01-29
> **Context:** MCP Spec 2025-11-25 Upgrade

These features were evaluated during the MCP spec upgrade but deferred due to architectural considerations or spec instability. Revisit when conditions change.

---

## 1. Sampling (CreateMessage)

**Spec Reference:** MCP 2025-06-18+

### What It Does
Allows MCP servers to request that the client's LLM generate text on the server's behalf.

### Practical Benefits
- **Agentic workflows** - Servers can ask the LLM to summarize documents, generate code, or make decisions without explicit user prompting
- **Server-side intelligence** - Tools can use AI reasoning internally (e.g., a code review server that asks the LLM to analyze changes)
- **Recursive agents** - Build multi-step agents where servers orchestrate LLM calls

### Why Deferred
MCP Router is a proxy/aggregator, not an LLM client. Implementing this would require either:
- Forwarding sampling requests to the actual client (complex routing, session management)
- Having MCP Router call an LLM directly (architectural change, cost implications, API key management)

### Revisit When
- There's demand for agentic MCP servers that need LLM access
- A clear pattern emerges for proxying sampling requests

---

## 2. Tasks (Experimental)

**Spec Reference:** MCP 2025-11-25 (Experimental)

### What It Does
Long-running background operations with progress tracking and cancellation support.

### Practical Benefits
- **Progress visibility** - Users see "Processing 45/100 files..." instead of waiting blindly
- **Cancellation** - Stop expensive operations mid-flight without killing the connection
- **Background processing** - Start a large migration, continue chatting, get notified when done
- **Better UX for slow tools** - Database exports, code generation, batch API operations

### Why Deferred
Still marked experimental in the spec. API surface may change significantly before stabilizing. The task lifecycle management adds complexity to the proxy layer.

### Revisit When
- Spec exits experimental status
- SDK provides stable task management APIs
- Users report pain with long-running tool calls through the router

**Priority:** HIGH - Most valuable feature once stable

---

## 3. Roots Capability

**Spec Reference:** MCP 2025-06-18+

### What It Does
Servers declare which filesystem paths/URIs they operate on. Clients can use this to understand server scope and enforce security boundaries.

### Practical Benefits
- **Security boundaries** - Client can verify a filesystem server only accesses declared directories
- **Context for clients** - LLM knows "this server works with /Users/rob/projects/foo"
- **Multi-project awareness** - Different servers for different project roots
- **Permission scoping** - Fine-grained access control based on declared roots

### Why Deferred
Only relevant for filesystem-based MCP servers. Current mcp-router architecture focuses on remote/API-based servers where roots don't apply meaningfully.

### Revisit When
- Filesystem MCP servers become common in the router ecosystem
- Users need multi-project isolation within a single router instance

**Priority:** LOW - Skip unless filesystem servers become common

---

## MCP Protocol Version Header

The `MCP-Protocol-Version` header is automatically handled by `@modelcontextprotocol/sdk` v1.25.2+ (enforced via pnpm override). No manual implementation required in mcp-router.

The SDK transport layer handles:
- **Client:** Sends header via `StreamableHTTPClientTransport.setProtocolVersion()`
- **Server:** Validates header in `WebStandardStreamableHTTPServerTransport.validateProtocolVersion()`

**Reference:** [MCP 2025-06-18 spec changelog](https://modelcontextprotocol.io/specification/2025-06-18/changelog)

---

## Implementation Notes

When revisiting these features, check:

1. **SDK Support** - Does `@modelcontextprotocol/sdk` have stable types?
2. **Ecosystem Adoption** - Are popular MCP servers using these features?
3. **Client Support** - Do Claude Desktop/Cursor/etc. support these capabilities?

### Related Files
- `docs/SECURITY.md` - Security mitigations implemented
- `packages/shared/src/types/` - Type definitions to extend
