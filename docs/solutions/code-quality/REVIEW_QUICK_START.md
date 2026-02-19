# Codebase Review Quick Start Guide

This guide helps review agents rapidly understand MCP Router's institutional knowledge and recurring patterns.

## What This Project Is

**MCP Router** is a cross-platform Electron/Web desktop app for managing MCP (Model Context Protocol) servers. It's a Clean Architecture system with:
- Electron main process (Node.js) with SQLite databases
- React renderer with Zustand state management
- IPC bridge with type-safe preload
- 12 domain APIs via Platform API abstraction

**98+ tracked issues** (46 completed, 52 pending) document the codebase's evolution.

---

## The 6 Patterns That Matter Most

### 1. Security Vulnerabilities (Recurring)
**What to look for:**
- IPC handlers accepting untrusted input without validation (OAuth state, HTTP headers, CLI args)
- Plaintext credentials stored in SQLite or JSON files (use safeStorage)
- VM sandbox expose dangerous globals (setTimeout, Promise, require, process)
- Path/URL construction without allowlist validation
- dangerouslySetInnerHTML with raw user SVG/HTML (use DOMPurify)

**Files to audit:**
- `apps/electron/src/main/modules/*/ipc.ts` -- validate all IPC inputs
- `apps/electron/src/main/utils/safe-storage.ts` -- credential storage
- `apps/electron/src/preload.ts` -- exposed APIs
- `apps/electron/src/main/modules/workflow/hook.service.ts` -- VM sandbox
- `docs/SECURITY.md` -- 8 vulnerability categories with remediation checklist

**Recent fixes to verify:**
- Token encryption (030) -- safeStorage with enc: prefix
- SVG sanitization (035) -- DOMPurify replaces regex
- SystemServer validation (020) -- all 6 tools now validate input
- VM sandbox (018) -- setTimeout/Promise removed

---

### 2. Type Safety at Boundaries (Critical)
**What to look for:**
- `[key: string]: any` index signatures on interfaces (especially preload)
- `Promise<any>` returns on IPC handlers
- Unvalidated type assertions in DB queries (`as SomeType`)
- Missing types in global.d.ts preload definitions

**Files to audit:**
- `apps/electron/src/global.d.ts` -- must have all preload methods typed, no index sig
- `apps/electron/src/main/modules/*/ipc.ts` -- all handlers must have explicit types
- Database queries -- no `as SomeType` without prior validation
- `apps/electron/src/preload.ts` -- types must match global.d.ts

**Recent fixes to verify:**
- global.d.ts (026) -- index signature removed, 110 methods typed explicitly
- request-handlers.ts (028) -- Promise<any> replaced with specific MCP SDK types
- All preload methods should have matching typed declarations

---

### 3. React Performance Regressions (High Impact)
**What to look for:**
- Zustand store calls using full destructuring instead of selectors
- useEffect dependency arrays containing state setters (causes loops)
- Stale closures in Zustand subscriptions
- Repeated DB queries with no caching
- Inline closures in event handlers (defeats React.memo)
- IPC get(id) methods that fetch entire list then filter client-side

**Files to audit:**
- All Zustand hook calls -- must use: `useStore(state => state.field)` not `useStore().field`
- useEffect dependency arrays -- if setState is called in effect, remove from deps
- Database queries in hot paths -- add caching with TTL + invalidation
- Event handlers -- extract to component level, don't define inline

**Recent fixes to verify:**
- useServerFiltering (023) -- god hook refactored to use selectors + memo
- Workflow lookup (024) -- added 5s TTL cache for workflow queries
- SkillsFileManager (025) -- all file I/O converted to async
- React.memo wrappers (040) -- ServerGridView, ServerListView, etc.

---

### 4. Synchronous I/O Blocking (Performance)
**What to look for:**
- `readFileSync`, `readdirSync`, `writeFileSync` in runtime code paths
- Blocking calls in main process outside initialization
- File operations not using `fsPromises`

**Files to audit:**
- `apps/electron/src/main/modules/skills/skills-file-manager.ts` -- should be all async
- Any `require('fs').readFileSync` patterns -- convert to import fs.promises and use await

**Recent fixes:**
- SkillsFileManager (025) -- 20+ Sync calls converted to fsPromises

---

### 5. IPC Implementation Gaps (Type & Security)
**What to look for:**
- IPC handler defined in ipc.ts but missing from preload.ts
- IPC handler in preload.ts but no type in global.d.ts
- IPC inputs not validated before use
- Privilege escalation via token scopes not checked
- Cache misses causing full broadcasts on every request

**Files to audit:**
- `apps/electron/src/main/modules/*/ipc.ts` -- every handler must validate inputs with Zod
- `apps/electron/src/preload.ts` -- must have matching wrapper for every IPC handler
- `apps/electron/src/global.d.ts` -- must have explicit types
- `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts` -- check tool routing cache

**Pattern to enforce:**
```typescript
// ipc.ts
ipcMain.handle('feature:action', async (evt, input: MyInput) => {
  // Validate input
  const validated = MyInputSchema.parse(input);
  // Use validated data
});

// preload.ts (in contextBridge.exposeInMainWorld)
featureAction: (input: MyInput) => ipcRenderer.invoke('feature:action', input),

// global.d.ts
interface Window {
  electronAPI: {
    featureAction: (input: MyInput) => Promise<ReturnType>;
  };
}
```

---

### 6. Architecture & Module Integration (Patterns)
**What to look for:**
- New Service/Repository without `getInstance()` and `resetInstance()`
- New Service/Repository not registered in `platform-api-manager.ts:configureForWorkspace()`
- IPC handler not registered in `apps/electron/src/main/infrastructure/ipc.ts`
- Module structure missing .service.ts or .repository.ts
- New types not exported from `packages/shared/src/types/index.ts`
- New UI features missing translations in `locales/en.json`

**Files to audit:**
- `apps/electron/src/main/modules/workspace/platform-api-manager.ts` -- check resetInstance calls
- `apps/electron/src/main/infrastructure/ipc.ts` -- check all handlers registered
- `packages/shared/src/types/index.ts` -- check exports for new domains
- `apps/electron/src/locales/en.json` -- check for UI translation keys

**Pattern to enforce (per NEW_FEATURE_CHECKLIST.md):**
- All Repositories/Services: implement getInstance() + resetInstance()
- Module structure: feature-name.service.ts, .repository.ts, .ipc.ts, .types.ts
- IPC naming: `feature:action` convention (e.g., `workspace:list`)
- Type centralization: `packages/shared/src/types/feature-types.ts`

---

## Quick Review Checklist

### Security (Must Pass)
- [ ] All IPC handlers validate input with Zod/schema
- [ ] All credentials stored via safeStorage, never plaintext
- [ ] Preload only exposes `ipcRenderer.invoke()` and `ipcRenderer.on()`
- [ ] VM sandbox context has no setTimeout, Promise, require, process
- [ ] External URLs use allowlist (https, not 127.0.0.1, not 169.254.x.x)
- [ ] Paths validated with `isPathContained()` to prevent traversal
- [ ] All `dangerouslySetInnerHTML` wrapped with `DOMPurify.sanitize()`
- [ ] No credentials/tokens in error messages or logs

### Type Safety (Must Pass)
- [ ] No `[key: string]: any` on boundary interfaces (preload, API, DB)
- [ ] All IPC handlers have explicit parameter and return types
- [ ] No `Promise<any>` in IPC handlers
- [ ] No unvalidated `as SomeType` type assertions in DB queries
- [ ] `pnpm typecheck` passes with 0 errors

### Performance (High Priority)
- [ ] All Zustand subscriptions use selectors: `useStore(s => s.field)`
- [ ] No `*Sync` fs calls in runtime paths (init OK)
- [ ] Child components with expensive renders wrapped in `React.memo()`
- [ ] Repeated DB/API queries have TTL caching + invalidation
- [ ] IPC get(id) calls fetch single item, not entire list

### Architecture (Medium Priority)
- [ ] New Repositories/Services in platform-api-manager.ts resetInstance
- [ ] IPC handlers follow `feature:action` naming
- [ ] Module structure complete (.service, .repository, .ipc, .types)
- [ ] New types exported from shared/src/types/index.ts
- [ ] UI features have locales/en.json translations

---

## Resources

**Full Institutional Knowledge:**
- `/docs/solutions/code-quality/codebase-review-institutional-knowledge.md` -- 7 sections, 80+ checks

**Security Audit:**
- `/docs/SECURITY.md` -- 8 vulnerability categories + line-by-line remediation checklist

**Latest Review:**
- `/docs/solutions/code-quality/comprehensive-review-19-findings.md` -- Feb 16, 2026 multi-agent findings

**Architecture Guides:**
- `/docs/adr/PLATFORM_API.md` -- Domain API design
- `/docs/adr/database/DATABASE_DESIGN_PATTERNS.md` -- Repository pattern
- `/CLAUDE.md` -- Project conventions

**Feature Addition:**
- `/docs/NEW_FEATURE_CHECKLIST.md` -- Complete workflow for new features

**Issue Tracking:**
- `/todos/README.md` -- 98-issue system (46 completed, 52 pending)

---

## Review Agent Roles

**Suggested Specialization:**

1. **Security Sentinel** -- IPC validation, credential storage, preload exposure, VM sandbox
2. **Type Safety Reviewer** -- Boundary types, any patterns, DB assertions, global.d.ts
3. **Performance Oracle** -- Zustand selectors, sync I/O, caching, React.memo usage
4. **Architecture Strategist** -- Singleton registration, module structure, IPC naming
5. **Code Quality Reviewer** -- Dead code, duplication, error handling, logs

**Parallel Execution:** Run security-critical items (Tier 1) in parallel with two-phase commits to avoid merge conflicts.

---

## How to Use This Guide

1. **Read this file first** (5 min) -- understand the 6 patterns
2. **Scan the checklist** (2 min) -- identify which areas to focus on
3. **Reference full institutional knowledge doc** as needed for deep dives
4. **Use SECURITY.md checklist** for line-by-line security verification
5. **Check todos/** for specific pending issues by priority

---

**Last Updated:** 2026-02-19
**Scope:** 98 tracked issues, 19-finding code review, 13 ADRs, 6+ completed solutions
