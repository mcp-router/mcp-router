# MCP Router Codebase Review: Institutional Knowledge & Recurring Patterns

## Executive Summary

The MCP Router codebase has a documented history of 98+ tracked issues (46 completed, 52 pending) spanning security, performance, type safety, and architecture. Past reviews reveal **6 core patterns** that consistently resurface and should guide comprehensive codebase review:

1. **VM Sandbox Escape Vulnerabilities** - Constructor-based escape vectors
2. **Plaintext Credential Storage** - Missing encryption at rest
3. **React Performance Regressions** - Zustand selector misuse, dependency array bugs
4. **IPC/Bridge Type Erosion** - `any` types defeating preload boundary safety
5. **Synchronous I/O Blocking** - Main process freezes from fs/db calls
6. **Authorization & Input Validation Gaps** - IPC handlers trusting untrusted input

---

## Part 1: Recurring Issue Patterns (Historical Analysis)

### Pattern 1: Security Vulnerabilities (Recurring)

**Past Issues (Completed):**
- VM sandbox escape via `setTimeout.constructor` access (018-P1)
- SVG sanitizer regex bypass allowing XSS (017, 035-P3)
- Command injection via unvalidated CLI inputs (034-P3)
- Plaintext token storage with default file permissions (030-P2)
- SystemServer credential leakage in API responses (019-P1)
- SystemServer missing input validation on 6 tool handlers (020-P1)

**Active Vulnerabilities (Pending):**
- OAuth/Auth token bypass via state parameter (docs/SECURITY.md #1)
- SSRF via URL injection in workspace configs (docs/SECURITY.md #2)
- Path traversal in resource URIs (docs/SECURITY.md #4)
- Arbitrary code execution in workflow hooks (docs/SECURITY.md #5)
- Unencrypted storage of bearer tokens in SQLite (docs/SECURITY.md #6)
- HTTP server dual-processing in Bearer auth (docs/SECURITY.md #7)
- DoS via workflow cycle bypasses + information leakage (docs/SECURITY.md #8)

**Key Insight:** Security issues cluster in:
- **IPC/Bridge layers** -- untrusted input not validated (OAuth state, HTTP headers, IPC params)
- **Credential handling** -- plaintext storage, leakage in API responses
- **Code execution** -- VM sandbox, dynamic imports, eval-like patterns
- **Path/URL handling** -- insufficient validation enabling traversal/SSRF

**Review Focus:**
- [ ] Audit all IPC handlers for input validation (use Zod)
- [ ] Check all credential/token storage (use safeStorage)
- [ ] Scan preload.ts for exposed dangerous APIs
- [ ] Validate all URL/path construction against allowlists
- [ ] Review VM sandbox context globals (no process/require/setTimeout)

---

### Pattern 2: Type Safety Erosion at Boundaries

**Past Issues (Completed):**
- global.d.ts `[key: string]: any` index signature defeating preload safety (026-P2)
- request-handlers.ts using `Promise<any>` throughout (028-P2)
- ServerModals.tsx any types (033-P3)

**Active Vulnerabilities (Pending):**
- Loss of exception type safety in error handling (080-P2)
- Blind database row type casting without validation (081-P2)
- Contextbridge type degradation from any index signatures (090-P3)

**Pattern:** Whenever `any` appears at type boundaries (IPC, DB, HTTP), validation gets skipped.

**Review Focus:**
- [ ] Ban `[key: string]: any` on interfaces exposed across boundaries
- [ ] Audit all IPC handlers for `Promise<any>` and replace with specific types
- [ ] Check database queries for unvalidated type assertions (`as SomeType`)
- [ ] Verify global.d.ts has complete typed method declarations (no index sig)

---

### Pattern 3: React Performance Regressions

**Past Issues (Completed):**
- Infinite re-render loop from setSelectedSkill in dependency array (007-P1)
- useServerFiltering "god hook" subscribing to 7 stores without selectors, 38+ return values (023-P2)
- Stale closure in Zustand store usage (009-P2)
- Workflow lookup with dynamic import + SQLite query on every request, no cache (024-P2)
- Inline closures defeating React.memo (040-P2)
- Duplicate skill object creation and client list IPC calls (012-013, P3)

**Active Vulnerabilities (Pending):**
- Redundant state refetches with Zustand (084-P2)
- Inefficient IPC get implementations (fetch entire list, find client-side) (083-P2)
- Broken reactive parity when list changes (079-P1)
- useEffect not triggered on workspace/auth changes (075-P1)

**Pattern:** Performance issues come from:
1. **Zustand misuse** -- accessing full store instead of selector
2. **Dependency array bugs** -- setter functions in deps causing loops
3. **No caching** -- repeated DB queries, dynamic imports, API calls
4. **Inefficient IPC** -- fetching all items to get one

**Review Focus:**
- [ ] Scan all Zustand store calls: must use selectors, not destructuring
- [ ] All useEffect dependency arrays reviewed for state setters
- [ ] Check for repeated DB queries in hot paths (add caching/memoization)
- [ ] IPC get methods: implement server-side filtering, not client-side fetch-all

---

### Pattern 4: Synchronous I/O Blocking Main Process

**Past Issues (Completed):**
- 20+ `*Sync` calls in SkillsFileManager (025-P2) -- all converted to fsPromises
- Manual file I/O blocking initialization (008-P2)

**Review Focus:**
- [ ] Search codebase for `readFileSync`, `readdirSync`, `writeFileSync` patterns
- [ ] Check if blocking calls are in initialization (acceptable) vs runtime paths (critical)
- [ ] Verify SkillsFileManager refactor is complete (no remaining Sync calls)

---

### Pattern 5: IPC Implementation Gaps

**Past Issues (Completed):**
- IPC handler argument mismatches between ipc.ts and preload.ts (015-P1)
- Missing handler registrations in ipc.ts (016-P1)

**Active Vulnerabilities (Pending):**
- Implicit privilege escalation via API tokens without scope checks (086-P2)
- Unbounded cache misses in tool routing (076-P1)
- Lack of strict runtime schema validation on IPC inputs (097-P3)
- Schema gaps in remote server updates (098-P3)

**Review Focus:**
- [ ] Verify every IPC handler has matching preload exposure and type definition
- [ ] Check all IPC inputs are validated with Zod before use
- [ ] Audit server:* handlers for privilege escalation (token scope, permission checks)

---

### Pattern 6: Architecture & Module Integration

**Completed Cleanups:**
- Dead code removal (new files not integrated) (006-P1)
- Singleton pattern registration gaps (all found and fixed in prior work)
- Skill object duplication and redundant wrapping (012-P3)
- Redundant handler wrappers removed (040-P2)
- SVG sanitizer regex replaced with DOMPurify (035-P3)

**Active Gaps (Pending):**
- No Multi-user/team support, no RBAC/SSO, desktop-only architecture (047-049, P1-2)
- No rate limiting or governance (050-P2)
- Over-engineered SingletonService and redundant repository wrappers (093-094, P3)

---

## Part 2: Architecture & Design Decisions

### Clean Architecture Layers (CLAUDE.md)

```
Renderer Process              Main Process                Database
  ├─ components/              ├─ modules/                 ├─ mcprouter.db
  ├─ stores/ (Zustand)        ├─ infrastructure/            (global)
  └─ platform-api/            │   ├─ ipc.ts              ├─ workspace-{id}.db
                              │   └─ database/               (per-workspace)
IPC Bridge:
Renderer → platform-api → preload.ts → IPC handlers → Service → Repository → SQLite
```

### Key Patterns

**1. Singleton Repository Pattern**
- All repositories implement `getInstance()` and `resetInstance()`
- Must register reset in `platform-api-manager.ts:configureForWorkspace()`
- Database isolation: global `mcprouter.db` + per-workspace `workspace-{id}.db`

**2. Module Structure**
- Each module has: `*.service.ts` (business logic), `*.repository.ts` (data), `*.ipc.ts` (handlers), `*.types.ts`
- Key modules: `mcp-server-manager`, `mcp-server-runtime`, `workspace`, `projects`, `skills`, `workflow`

**3. Type System Centralization**
- Types in `packages/shared/src/types/`
- Platform API interfaces in `packages/shared/src/types/platform-api/domains/`
- Domain APIs: app, auth, clientApps, cloudSync, logs, marketplace, packages, projects, servers, settings, skills, workflows, workspaces

**4. IPC Naming Convention**
- `feature:action` format (e.g., `workspace:list`, `server:start`)
- All handlers must validate input (no `any` types)
- Types exposed in `global.d.ts` (required for React TypeScript)

---

## Part 3: Known Architectural Decisions (ADRs)

### Platform API (ADR)
- **Decision:** Domain-driven design organizing 12 main domain APIs
- **Rationale:** Eliminates scattered responsibility, enables type safety, clear platform differences
- **Implementations:** `ElectronPlatformAPI` (Electron), `RemotePlatformAPI` (Web/fallback)

### Database Architecture
- **Pattern:** Repository + BaseRepository abstract class
- **Singleton strategy:** Prevents concurrent DB access, workspace isolation via instance reset
- **Transaction management:** Unified error handling, type safety via `mapRowToEntity`

### Type System
- **Boundary types:** Full explicit typing at preload and API boundaries (no index signatures)
- **Component Props:** Allowed in `.tsx` files only
- **Shared types:** `@mcp_router/shared/types` imported everywhere

---

## Part 4: Comprehensive Review Checklist

### Security (Pass/Fail Gates)
- [ ] **IPC Validation:** Every handler validates inputs with Zod/schema
- [ ] **Credential Storage:** All tokens/keys use safeStorage, never plaintext
- [ ] **Preload Exposure:** Only `ipcRenderer.invoke/on` exposed via contextBridge
- [ ] **VM Sandbox:** No `setTimeout`, `Promise`, `require`, `process`, or eval-accessible globals
- [ ] **URL Validation:** External URLs validated against allowlist (https, not internal/private IPs)
- [ ] **Path Traversal:** All path construction uses `path.join()`, validated with `isPathContained()`
- [ ] **SVG/HTML:** All `dangerouslySetInnerHTML` uses DOMPurify, never raw user input
- [ ] **Authorization:** IPC handlers with privilege requirements check permissions
- [ ] **Error Handling:** No credential leakage in error messages or logs

### Type Safety (Pass/Fail Gates)
- [ ] **No index signatures:** `[key: string]: any` banned on boundary interfaces
- [ ] **All IPC typed:** Every handler has explicit parameter and return types
- [ ] **DB queries typed:** No `as SomeType` assertions without validation
- [ ] **Preload complete:** global.d.ts has all methods, no catch-all index sig
- [ ] **typecheck clean:** `pnpm typecheck` passes, 0 errors

### Performance
- [ ] **Zustand selectors:** All store subscriptions use selector functions, no destructuring
- [ ] **React.memo:** Components with expensive renders wrapped in memo
- [ ] **No sync I/O:** No `*Sync` fs calls in runtime paths (initialization OK)
- [ ] **Caching:** Repeated DB/API queries cached with invalidation on mutation
- [ ] **No inline closures:** Event handlers extracted to prevent memo bypass
- [ ] **IPC efficiency:** get(id) calls fetch single item, not full list

### Architecture
- [ ] **Singleton registration:** All new Repository/Service have resetInstance in platform-api-manager.ts
- [ ] **Module structure:** Feature modules have .service, .repository, .ipc, .types files
- [ ] **IPC naming:** All handlers follow `feature:action` convention
- [ ] **Type exports:** All new types exported from shared/src/types/index.ts
- [ ] **Translation keys:** UI features have locales/en.json entries

---

## Part 5: Past Solutions (Known Fixes to Verify)

### Fix 1: Token Encryption (030)
- **Status:** Completed (uses safeStorage with enc: prefix)
- **Files:** `apps/electron/src/main/utils/safe-storage.ts`, `apps/electron/src/main/modules/auth/*`
- **Verification:** All token saves go through safeStorage, never plaintext to JSON

### Fix 2: Zustand Selectors (023)
- **Status:** Completed (useServerFiltering refactored)
- **Verification:** Home component uses granular selectors, children wrapped in memo

### Fix 3: Async FS (025)
- **Status:** Completed (SkillsFileManager converted to fsPromises)
- **Files:** `apps/electron/src/main/modules/skills/skills-file-manager.ts`
- **Verification:** No `*Sync` calls remain in skills module

### Fix 4: SVG Sanitization (035)
- **Status:** Completed (replaced regex with DOMPurify)
- **Files:** `apps/electron/src/renderer/utils/svg-sanitizer.ts`
- **Verification:** ClientStatusIcon, UnifiedSkillDetailSheet use `sanitizeSvgWithStyles()`

### Fix 5: Type Boundaries (026, 028)
- **Status:** Completed (global.d.ts index sig removed, request-handlers typed)
- **Verification:** 110 preload methods have explicit types, zero `any` on boundaries

---

## Part 6: Pending Issues Requiring Review

### P1 (Critical)
1. **Tool Catalog Auth Regression (063)** -- OAuth state validation
2. **Use Platform API Reactivity (075)** -- Zustand selector equality in usePlatformAPI
3. **Unbounded Cache Misses (076)** -- Tool routing broadcasts on negative lookups
4. **Path Traversal/Workspace Deletion (077)** -- User input in workspace path construction
5. **Invisible Agent Features (078)** -- SystemServer tool parity gaps

### P2 (Important)
- Loss of exception type safety (080)
- Blind database row casting (081)
- Inefficient IPC gets (083)
- Redundant state refetches (084)
- Plaintext MCP server secrets (085)
- Implicit privilege escalation (086)
- Blind diagnostics/no logs (087)
- Incomplete workspace parity (088)

### P3 (Nice-to-have)
- Contextbridge type degradation (090)
- Non-null assertions (092)
- Over-engineered singletons (093)
- Redundant wrappers (094)
- No will-navigate protection (096)
- Strict runtime schema validation (097)

---

## Part 7: Key Review Agents & Findings

**From 19-Finding Code Review (Feb 16):**

Six specialist agent teams identified findings:
1. **Security Sentinel** -- 7 critical/high security issues
2. **Performance Oracle** -- 3 critical regressions (god hook, cache misses, sync I/O)
3. **TypeScript Reviewer** -- 4 type safety gaps
4. **Agent-Native Reviewer** -- SystemServer tool parity (7 new tools added)
5. **Architecture Strategist** -- Module structure & patterns
6. **Code Simplicity Reviewer** -- Duplication & unnecessary abstractions

**Resolution Strategy:** Parallel agents on security (critical-first), then remaining in two-phase commits to avoid merge conflicts.

---

## Summary: What Review Agents Should Focus On

### Tier 1 (Security-Critical, Pass/Fail)
1. **IPC Input Validation** -- All handlers have Zod/schema guards
2. **Credential Storage** -- safeStorage throughout, no plaintext
3. **Preload Exposure** -- Only safe APIs exposed (no require, process, etc.)
4. **VM Sandbox** -- No escape vectors (no setTimeout, Promise constructor access)
5. **URL/Path Validation** -- Allowlists for external URLs, path containment checks

### Tier 2 (Type/Performance, High Priority)
6. **Type Boundaries** -- No `any` at preload/DB/API borders
7. **Zustand Selectors** -- All subscriptions use selectors
8. **Sync I/O** -- No blocking calls in runtime paths
9. **IPC Efficiency** -- No fetch-all-and-filter patterns

### Tier 3 (Architecture, Medium Priority)
10. **Singleton Registration** -- New Services/Repos in platform-api-manager.ts
11. **Module Structure** -- Feature modules have .service, .repo, .ipc, .types
12. **Type Exports** -- All public types in shared/src/types/index.ts

---

## Resources

- **docs/SECURITY.md** -- Comprehensive 8-category security audit (critical + mitigations)
- **docs/solutions/code-quality/comprehensive-review-19-findings.md** -- Latest multi-agent review
- **docs/NEW_FEATURE_CHECKLIST.md** -- Complete feature addition workflow
- **docs/adr/PLATFORM_API.md** -- Domain API architecture
- **docs/adr/database/DATABASE_DESIGN_PATTERNS.md** -- Repository pattern & singleton strategy
- **todos/README.md** -- 98-issue tracking system (46 completed, 52 pending)
