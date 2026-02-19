---
status: complete
priority: p2
issue_id: "121"
tags: [code-review, duplication, simplicity]
dependencies: []
---

# DXT and MCPB Converters Have ~150 Lines of Duplicated Logic

`dxt-converter.ts` (190 lines) and `mcpb-converter.ts` (188 lines) implement nearly identical logic for 6 functions, with approximately 150 lines of duplicated code.

## Problem Statement

The DXT and MCPB format converters share the same core logic for converting package manifests into MCP server configurations. Six functions are duplicated with only minor differences (manifest type names):

| Function | dxt-converter.ts | mcpb-converter.ts |
|----------|-----------------|-------------------|
| `generateServerId()` | Line 68 | Line 65 |
| `checkPlatformCompatibility()` | Line 77 | Line 70 |
| `resolvePlatformSpecificConfig()` | Line 95 | Line 87 |
| `convertUserConfig()` | Line 115 | Line 113 |
| `expandVariables()` | Line 144 | Line 155 |
| `expandPathVariables()` | Line 162 | Line 170 |

This duplication means:
1. Bug fixes must be applied in both files.
2. Behavior divergence is likely over time (one file gets fixed, the other does not).
3. Adding a new format (e.g., a future packaging standard) requires copying the same logic a third time.

## Findings

- `apps/electron/src/main/modules/mcp-server-manager/dxt-processor/dxt-converter.ts` (190 lines)
- `apps/electron/src/main/modules/mcp-server-manager/mcpb-processor/mcpb-converter.ts` (188 lines)
- Both files define the same 6 helper functions with nearly identical implementations.
- The main difference is the manifest type (`DxtManifest` vs `McpbManifest`) and the path variable name (`dxtPath` vs `extractedPath`).
- The core logic (platform checking, config resolution, variable expansion) is identical.
- `expandVariables` in dxt-converter uses `any` types while mcpb-converter uses `unknown` -- an example of divergence already occurring.

**Location:**
- `apps/electron/src/main/modules/mcp-server-manager/dxt-processor/dxt-converter.ts`
- `apps/electron/src/main/modules/mcp-server-manager/mcpb-processor/mcpb-converter.ts`

## Proposed Solutions

### Option 1: Extract shared converter utility module (recommended)

**Approach:** Create a shared `converter-utils.ts` (or `package-converter-base.ts`) in the `mcp-server-manager` directory with generic versions of the 6 shared functions. Both converters import and call the shared functions.

```typescript
// converter-utils.ts
export function generateServerId(name: string, version?: string): string { ... }
export function checkPlatformCompatibility(platforms: PlatformConfig): void { ... }
export function resolvePlatformSpecificConfig(platforms: PlatformConfig): ResolvedConfig { ... }
export function convertUserConfig(basePath: string, configs: UserConfigMap): InputParam[] { ... }
export function expandVariables(value: unknown, basePath: string): unknown { ... }
export function expandPathVariables(value: string, basePath: string): string { ... }
```

**Pros:**
- Eliminates ~150 lines of duplication
- Single source of truth for shared logic
- Bug fixes apply to both formats automatically
- Easy to add new formats

**Cons:**
- Need to define shared interfaces for the common manifest shape
- Minor refactor of both converter files

**Effort:** 2-3 hours

**Risk:** Low

---

### Option 2: Base class with format-specific overrides

**Approach:** Create an abstract `PackageConverter` base class with the shared logic. `DxtConverter` and `McpbConverter` extend it with format-specific parsing.

**Pros:**
- Strong OOP pattern for extensibility
- Format-specific behavior is clearly separated
- New formats just extend the base

**Cons:**
- Classes may be overkill for what are currently module-level functions
- Inheritance adds coupling
- More code than simple utility extraction

**Effort:** 3-4 hours

**Risk:** Low

---

### Option 3: Generic converter function with format adapters

**Approach:** Create a single generic `convertPackage()` function that takes a format adapter (interface with manifest-specific accessors). Each format provides its adapter.

**Pros:**
- Most flexible design
- Format-specific logic is minimal
- Adapter pattern is testable in isolation

**Cons:**
- Adapter interface may be over-engineered
- Harder to understand than direct function calls

**Effort:** 3-4 hours

**Risk:** Low

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/mcp-server-manager/dxt-processor/dxt-converter.ts` (190 lines)
- `apps/electron/src/main/modules/mcp-server-manager/mcpb-processor/mcpb-converter.ts` (188 lines)
- New file: shared converter utilities (to be created)

**Related components:**
- DXT package installation pipeline
- MCPB package installation pipeline
- Manifest type definitions (`DxtManifest`, `McpbManifest`)
- Platform compatibility checking

## Acceptance Criteria

- [ ] Shared logic extracted to a single module (no duplication)
- [ ] Both DXT and MCPB converters use the shared module
- [ ] `expandVariables` uses consistent types (not `any` in one and `unknown` in the other)
- [ ] DXT installation still works correctly
- [ ] MCPB installation still works correctly
- [ ] `pnpm typecheck` passes
- [ ] Total line count reduced by ~100+ lines

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Code Review

**Actions:**
- Compared dxt-converter.ts and mcpb-converter.ts side by side
- Identified 6 duplicated functions
- Noted type divergence (`any` vs `unknown`) as evidence of independent drift
- Estimated ~150 lines of duplicated logic

**Learnings:**
- The MCPB converter was likely copied from the DXT converter and adapted
- Type inconsistency between the two files has already begun

## Resources

### 2026-02-19 - Backlog Closure

**By:** Codex

**Disposition:** deferred-tech-debt

**Notes:** Closed as deferred technical debt after review; requires larger architectural or product-scope changes beyond this hardening pass.
