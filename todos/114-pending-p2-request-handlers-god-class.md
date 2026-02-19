---
status: pending
priority: p2
issue_id: "114"
tags: [code-review, architecture]
dependencies: []
---

# RequestHandlers is a 1,097-Line God Class

`RequestHandlers` handles tools, resources, prompts, elicitation, rate limiting, token validation, project filtering, system routing, catalog routing, and mode branching in a single class, violating the Single Responsibility Principle.

## Problem Statement

`request-handlers.ts` is 1,097 lines long and manages at least 10 distinct concerns:
1. Tool request handling and routing
2. Resource request handling
3. Prompt request handling
4. Elicitation request handling
5. Rate limiting enforcement
6. Token validation and access control
7. Project-based filtering
8. System server tool routing
9. Tool catalog routing
10. Mode branching (direct vs. aggregated)

This creates several problems:
- Any change to one concern risks breaking another.
- Testing requires mocking all dependencies even when testing a single concern.
- Code review is difficult -- reviewers must hold 1,097 lines in context.
- New developers cannot quickly understand what the class does.
- Adding new request types (e.g., for new MCP protocol features) further bloats the class.

## Findings

- `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts` line 84: `export class RequestHandlers extends RequestHandlerBase`
- File is 1,097 lines (confirmed via `wc -l`).
- `getAllToolsInternal()` at line 688 handles tool collection, filtering, and system tool injection.
- Multiple `handle*` methods for different request types (tools, resources, prompts).
- Rate limiting, token validation, and project filtering are inlined rather than delegated.

**Location:**
- `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts` (1,097 lines)

## Proposed Solutions

### Option 1: Extract focused handler classes (recommended)

**Approach:** Split into focused handler classes:
- `ToolRequestHandler` -- tool listing, tool call routing, system/catalog delegation
- `ResourceRequestHandler` -- resource listing and reading
- `PromptRequestHandler` -- prompt listing and getting
- `ElicitationRequestHandler` -- elicitation handling
- Keep `RequestHandlers` as a thin dispatcher that delegates to the focused handlers.

**Pros:**
- Each class has a single responsibility
- Independent testing of each concern
- Easier code review and onboarding
- New MCP features get their own handler class

**Cons:**
- Significant refactor effort
- Need to manage shared state (token, project context) across handlers
- Potential for over-abstraction if taken too far

**Effort:** 1-2 days

**Risk:** Medium (large refactor, but low risk if done incrementally)

---

### Option 2: Extract cross-cutting concerns as middleware

**Approach:** Extract rate limiting, token validation, and project filtering into middleware/decorator functions. Apply them to each handler method.

**Pros:**
- Removes 3 concerns from the class without full restructure
- Middleware is reusable across handlers
- Smaller initial refactor

**Cons:**
- Does not address the core class size issue
- Still leaves 700+ lines of handler logic in one class

**Effort:** 4-6 hours

**Risk:** Low

---

### Option 3: Incremental extraction starting with largest methods

**Approach:** Extract the largest methods first (`getAllToolsInternal` at ~170 lines, tool call routing) into separate modules. Leave the class as dispatcher.

**Pros:**
- Manageable incremental changes
- Each extraction is independently reviewable
- No big-bang refactor

**Cons:**
- Class remains large until multiple extractions complete
- May leave awkward intermediate states

**Effort:** 2-4 hours per extraction, multiple sessions

**Risk:** Low

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts` (primary)
- `apps/electron/src/main/modules/mcp-server-runtime/request-handler-base.ts` (base class)

**Related components:**
- Aggregator server (registers request handlers)
- System server (tool routing target)
- Tool catalog service (search routing target)
- Token validator (authentication dependency)
- Rate limiter (rate limiting dependency)

## Acceptance Criteria

- [ ] No single handler class exceeds 300 lines
- [ ] Each extracted handler has a clear single responsibility
- [ ] All existing tool/resource/prompt handling behavior is preserved
- [ ] `pnpm typecheck` passes
- [ ] Existing tests pass (if any)
- [ ] New handlers are independently testable

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Code Review

**Actions:**
- Measured file at 1,097 lines
- Identified 10+ distinct responsibilities in a single class
- Reviewed method sizes and dependency patterns
- Assessed extraction boundaries

**Learnings:**
- The `getAllToolsInternal` method alone is ~170 lines and handles multiple concerns
- Rate limiting and token validation are repeated patterns that could be middleware

## Resources

### 2026-02-19 - Backlog Closure

**By:** Codex

**Disposition:** deferred-tech-debt

**Notes:** Closed as deferred technical debt after review; requires larger architectural or product-scope changes beyond this hardening pass.

### 2026-02-19 - Reopened Deferred Backlog

**By:** Codex

**Action:** Reopened from complete to pending per user instruction because the work is deferred, not implemented.

**Tracking:** Included in /Users/robdezendorf/Documents/GitHub/mcp-router/todos/DEFERRED_BACKLOG.md.
