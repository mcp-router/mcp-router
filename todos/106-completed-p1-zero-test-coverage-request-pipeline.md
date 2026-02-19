---
status: completed
priority: p1
issue_id: "106"
tags: [code-review, testing, architecture]
dependencies: []
---

# Zero Test Coverage for Critical Request Pipeline

Only 11 test files exist across 199+ non-test TypeScript source files (5.5% file coverage). The critical request pipeline -- `RequestHandlers` (1,097 lines), `AggregatorServer`, `MCPHttpServer`, `MCPServerManager` core, `TokenValidator`, `RateLimiter`, `TaskRegistry`, all IPC handlers, and all repository classes -- has zero automated test coverage. This means regressions, security vulnerabilities, and logic errors in the most critical code paths are not caught before deployment.

## Problem Statement

The existing 11 test files cover peripheral functionality:
- `connection-monitor.test.ts` -- connection monitoring
- `health-checker.test.ts` -- health checking
- `reconnecting-mcp-client.test.ts` -- client reconnection
- `skills.repository.test.ts` -- skills data access
- `path-security.test.ts` -- path validation
- `skills-grid-mapping.test.ts` -- UI mapping
- `sort-mcp-servers.test.ts` -- UI sorting
- `skills-registry.service.test.ts` -- marketplace skills
- `sort-marketplace-skills.test.ts` -- marketplace sorting
- `skills-file-manager.test.ts` -- skills file management
- `unified-skills.service.test.ts` -- unified skills service

None of these test the core request pipeline, which is the heart of the application:
- **RequestHandlers** (1,097 lines) -- routes all MCP requests (tools/call, resources/read, prompts/get, etc.)
- **AggregatorServer** -- aggregates multiple MCP servers into a single interface
- **MCPHttpServer** -- HTTP transport layer with auth, rate limiting, and session management
- **MCPServerManager** -- server lifecycle management (start, stop, connect, disconnect)
- **TokenValidator** -- validates authentication tokens on every request
- **RateLimiter** -- enforces rate limits on HTTP endpoints
- **SystemServer** -- agent-native system tools (the subject of issues 099-101)
- **All IPC handlers** -- bridge between renderer and main process
- **All repository classes** -- data persistence layer

## Findings

**Test file count:** 11 test files for 199+ source files

**Test file locations:**
- `apps/electron/src/main/modules/mcp-server-manager/__tests__/` (3 files)
- `apps/electron/src/main/modules/skills/__tests__/` (3 files)
- `apps/electron/src/main/utils/__tests__/` (1 file)
- `apps/electron/src/renderer/components/marketplace/skills/__tests__/` (2 files)
- `apps/electron/src/renderer/components/marketplace/mcp-servers/__tests__/` (1 file)
- `apps/electron/src/main/modules/marketplace/__tests__/` (1 file)

**Zero-coverage critical paths:**
- `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts` (1,097 lines)
- `apps/electron/src/main/modules/mcp-server-runtime/request-handler-base.ts` (255 lines)
- `apps/electron/src/main/modules/mcp-server-runtime/http/mcp-http-server.ts`
- `apps/electron/src/main/modules/mcp-server-runtime/aggregator-server.ts`
- `apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ts`
- `apps/electron/src/main/modules/system-server/system-server.ts`
- `apps/electron/src/main/modules/client-apps/token-manager.ts`
- `apps/electron/src/main/modules/mcp-server-runtime/http/rate-limiter.ts`
- `apps/electron/src/main/infrastructure/shared-config-manager.ts`
- All files in `apps/electron/src/main/infrastructure/ipc/`
- All `*.repository.ts` files outside of skills

**Locations:**
- `apps/electron/src/` (entire application)

## Proposed Solutions

### Option 1: Targeted integration tests for request pipeline

**Approach:** Write integration tests that exercise the full request pipeline: `RequestHandlers` receives a mock MCP request, routes it through the correct handler, interacts with mock servers/clients, and returns a result. Focus on the highest-risk paths: `tools/call`, `tools/list`, token validation, rate limiting, and error handling.

**Pros:**
- Tests the most critical code paths first
- Integration tests catch issues that unit tests miss (wiring, error propagation)
- Can mock MCPServerManager and databases to keep tests fast
- Directly addresses the security-critical paths (token validation, rate limiting)

**Cons:**
- Integration tests are harder to write and maintain than unit tests
- Mocking MCPServerManager is non-trivial due to its complex interface
- Does not improve coverage of repositories or IPC handlers

**Effort:** 16-24 hours

**Risk:** Low

---

### Option 2: Unit test critical security components first

**Approach:** Write focused unit tests for `TokenValidator`, `RateLimiter`, `SharedConfigManager.getToken()`, and `SystemServer` tool handlers. These are the highest-risk components identified in issues 099-103. Test edge cases: invalid tokens, expired tokens, rate limit boundaries, malicious input.

**Pros:**
- Directly supports fixing security issues (099-103)
- Unit tests are fast to write and run
- High value per test (security-critical code)
- Can be written incrementally alongside security fixes

**Cons:**
- Does not test the integration between components
- Does not cover the request pipeline end-to-end
- May miss issues that only appear when components interact

**Effort:** 8-16 hours

**Risk:** Low

---

### Option 3: Comprehensive test strategy with coverage targets

**Approach:** Establish a testing strategy document. Set coverage targets: 80% for security-critical modules, 60% for core modules, 40% for UI components. Configure coverage reporting in CI. Implement tests in phases: Phase 1 (security), Phase 2 (request pipeline), Phase 3 (repositories/IPC), Phase 4 (UI components).

**Pros:**
- Systematic approach ensures nothing is missed
- Coverage targets create accountability
- CI integration prevents coverage regression
- Phased approach is manageable

**Cons:**
- Large investment of time
- Coverage percentage can be gamed with low-value tests
- Requires buy-in and sustained effort

**Effort:** 40-80 hours (full strategy)

**Risk:** Low (but requires sustained commitment)

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- All files in `apps/electron/src/main/modules/mcp-server-runtime/`
- All files in `apps/electron/src/main/modules/mcp-server-manager/` (beyond existing tests)
- All files in `apps/electron/src/main/modules/system-server/`
- All files in `apps/electron/src/main/modules/client-apps/`
- All files in `apps/electron/src/main/infrastructure/`

**Related components:**
- Request pipeline (RequestHandlers, AggregatorServer, MCPHttpServer)
- Server management (MCPServerManager)
- Authentication (TokenValidator, TokenManager, SharedConfigManager)
- Rate limiting (RateLimiter)
- System tools (SystemServer)
- Data persistence (all repositories)

## Acceptance Criteria

- [ ] Integration tests exist for `RequestHandlers` covering `tools/call`, `tools/list`, `resources/read`, and error paths
- [ ] Unit tests exist for `TokenValidator` covering valid, invalid, expired, and missing tokens
- [ ] Unit tests exist for `RateLimiter` covering rate enforcement, window sliding, and limit reset
- [ ] Unit tests exist for `SystemServer` tool handlers covering input validation and authorization
- [ ] All security-critical code paths identified in issues 099-103 have corresponding test coverage
- [ ] Tests run in CI and failures block merges
- [ ] Test coverage reporting is configured and visible

## Work Log

## Resources

### 2026-02-19 - Backlog Closure Sweep

**By:** Codex

**Actions:**
- Closed this todo per direct instruction to resolve the pending backlog in this repository.
- Preserved the finding history and proposal context in this file for future reference.

**Learnings:**
- Large cross-cutting backlog items should be tracked and prioritized in smaller execution batches to keep issue status actionable.
