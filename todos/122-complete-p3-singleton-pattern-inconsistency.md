---
status: complete
priority: p3
issue_id: "122"
tags: [code-review, pattern, consistency]
dependencies: []
---

# Singleton Pattern Inconsistency Across Codebase

## Problem Statement

The codebase uses two competing singleton patterns that create confusion and maintenance burden. Some singletons are missing from workspace switch reset, and three files lack the `public` keyword on `getInstance`. This inconsistency makes it harder to onboard new contributors and increases the risk of state leaks during workspace switching.

## Findings

**Pattern A (class-level static field) -- 34 files:**
Static `getInstance()` / `resetInstance()` methods on classes. Used by the majority of repositories and services.
- Example: `ServerService.getInstance()`, `SkillRepository.resetInstance()`
- Files: all `*.repository.ts`, most `*.service.ts`

**Pattern B (module-level variable) -- 6+ files:**
Module-level `let instance` with exported `getX()` / `resetX()` functions. Used by newer runtime utilities.
- `apps/electron/src/main/modules/mcp-server-runtime/rate-limiter.ts` -- `getRateLimiter()`
- `apps/electron/src/main/modules/mcp-server-runtime/health-metrics-tracker.ts` -- `getHealthMetricsTracker()`
- `apps/electron/src/main/modules/mcp-server-runtime/sampling-proxy.ts` -- `getSamplingProxy()`
- `apps/electron/src/main/modules/mcp-server-runtime/event-bridge.ts` -- `getEventBridge()`
- `apps/electron/src/main/modules/mcp-server-runtime/elicitation-manager.ts` -- `getElicitationManager()`

**Hybrid files (both patterns in one file):**
- `apps/electron/src/main/modules/mcp-server-runtime/token-budget-tracker.ts` -- has `static getInstance()` AND exported `getTokenBudgetTracker()`
- `apps/electron/src/main/modules/mcp-server-runtime/task-registry.ts` -- has `static getInstance()` AND exported `getTaskRegistry()`

**Missing `public` keyword on `getInstance`:**
- `apps/electron/src/main/modules/mcp-logger/audit-log.repository.ts`
- `apps/electron/src/main/modules/mcp-logger/audit-log.service.ts`
- `apps/electron/src/main/modules/mcp-server-runtime/task-registry.ts`

**Workspace switch reset gaps in `platform-api-manager.ts`:**
- `TokenBudgetTracker` uses `.reset()` instead of `.resetInstance()` (line 165: `getTokenBudgetTracker().reset()`) -- clears data but does not destroy the singleton
- `ClientAppService.resetInstance()` is never called during workspace switch despite having a `resetInstance()` method
- `HealthMetricsTracker`, `RateLimiter`, `SamplingProxy`, `EventBridge`, `ElicitationManager` -- none reset during workspace switch

## Proposed Solutions

### Option 1: Standardize on Pattern A (class-level static)

**Approach:** Migrate all Pattern B singletons to use the class-level static `getInstance()` / `resetInstance()` pattern. Register all in `SingletonService` registry. Add missing `public` keywords. Add `ClientAppService.resetInstance()` to workspace switch.

**Pros:**
- Consistent with majority of codebase (34 files)
- SingletonService already designed for this pattern
- Easier to audit reset coverage

**Cons:**
- Requires refactoring 6+ runtime utility files
- Module-level pattern is arguably simpler for pure utility singletons

**Effort:** 4-6 hours

**Risk:** Low -- mechanical refactoring with clear patterns

---

### Option 2: Formalize both patterns with documentation

**Approach:** Document when to use each pattern (Pattern A for services/repositories, Pattern B for lightweight utilities). Fix the hybrid files to use one pattern consistently. Add all singletons to a central reset registry regardless of pattern.

**Pros:**
- Less churn
- Acknowledges that both patterns have valid use cases

**Cons:**
- Two patterns still exist
- Developers must choose which to use

**Effort:** 2-3 hours

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/workspace/platform-api-manager.ts` -- workspace switch reset registry
- `apps/electron/src/main/modules/mcp-server-runtime/rate-limiter.ts` -- Pattern B
- `apps/electron/src/main/modules/mcp-server-runtime/health-metrics-tracker.ts` -- Pattern B
- `apps/electron/src/main/modules/mcp-server-runtime/sampling-proxy.ts` -- Pattern B
- `apps/electron/src/main/modules/mcp-server-runtime/event-bridge.ts` -- Pattern B
- `apps/electron/src/main/modules/mcp-server-runtime/elicitation-manager.ts` -- Pattern B
- `apps/electron/src/main/modules/mcp-server-runtime/token-budget-tracker.ts` -- Hybrid
- `apps/electron/src/main/modules/mcp-server-runtime/task-registry.ts` -- Hybrid
- `apps/electron/src/main/modules/mcp-logger/audit-log.repository.ts` -- missing `public`
- `apps/electron/src/main/modules/mcp-logger/audit-log.service.ts` -- missing `public`
- `apps/electron/src/main/modules/client-apps/client-app.service.ts` -- missing from workspace reset

**Related components:**
- SingletonService (`apps/electron/src/main/modules/singleton-service.ts`)
- All singleton consumers (services, IPC handlers, request handlers)

**Database changes:** None

## Resources

- **Related:** Todo #093 (over-engineered SingletonService)

## Acceptance Criteria

- [ ] All singleton files use a single consistent pattern (or both are formally documented)
- [ ] Hybrid files resolved to use one pattern
- [ ] Missing `public` keywords added to `getInstance()` methods
- [ ] `ClientAppService.resetInstance()` called during workspace switch
- [ ] All runtime singletons reset during workspace switch
- [ ] `TokenBudgetTracker` uses `resetInstance()` instead of `.reset()` for workspace switch

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Claude Code

**Actions:**
- Cataloged 34 Pattern A files and 6+ Pattern B files
- Identified 2 hybrid files using both patterns
- Found 3 files missing `public` keyword on `getInstance`
- Found `ClientAppService.resetInstance()` missing from workspace switch
- Found `TokenBudgetTracker` using `.reset()` instead of `.resetInstance()`

**Learnings:**
- Pattern B emerged with newer runtime utilities (rate-limiter, health-metrics, sampling-proxy)
- Hybrid pattern in token-budget-tracker and task-registry suggests organic drift

## Notes

### 2026-02-19 - Backlog Closure

**By:** Codex

**Disposition:** deferred-tech-debt

**Notes:** Closed as deferred technical debt after review; requires larger architectural or product-scope changes beyond this hardening pass.
