---
status: complete
priority: p2
issue_id: "109"
tags: [code-review, typescript, security]
dependencies: []
---

# TokenValidator Returns `any` at Security Boundary

`TokenValidator.validateToken()` returns `any` and `listTokens()` returns `any[]`, eliminating type safety at a critical security boundary.

## Problem Statement

The `TokenValidator` class is the gatekeeper for API token authentication. Two of its public methods have untyped return values:
- `validateToken(token: string): any` (line 74) -- callers extract `.clientId`, `.isValid`, and other properties without any type narrowing or compile-time validation.
- `listTokens(): any[]` (line 91) -- returns an array with no shape guarantee.

This means:
1. A refactor to the token manager that changes property names will not produce compile errors.
2. Callers can access nonexistent properties silently (e.g., `result.isvalid` vs `result.isValid`).
3. Security-critical branching (is the token valid?) depends on untyped data.

## Findings

- `apps/electron/src/main/modules/mcp-server-runtime/token-validator.ts` line 74:
  ```typescript
  public validateToken(token: string): any {
    return this.tokenManager.validateToken(token);
  }
  ```
- `apps/electron/src/main/modules/mcp-server-runtime/token-validator.ts` line 91:
  ```typescript
  public listTokens(): any[] {
    return this.tokenManager.listTokens();
  }
  ```
- `validateTokenAndAccess()` at line 27 calls `this.tokenManager.validateToken(token)` and accesses `.clientId` and `.isValid` without narrowing.
- The underlying `tokenManager` likely has types, but they are erased by the `any` return type.

**Location:**
- `apps/electron/src/main/modules/mcp-server-runtime/token-validator.ts` lines 74, 91

## Proposed Solutions

### Option 1: Define explicit result interfaces

**Approach:** Create `TokenValidationResult` and `TokenInfo` interfaces, apply them as return types:
```typescript
interface TokenValidationResult {
  isValid: boolean;
  clientId?: string;
  expiresAt?: number;
}

interface TokenInfo {
  clientId: string;
  createdAt: number;
  lastUsed?: number;
}

public validateToken(token: string): TokenValidationResult { ... }
public listTokens(): TokenInfo[] { ... }
```

**Pros:**
- Full compile-time safety for all callers
- Self-documenting API
- Catches property name mismatches immediately
- Security boundary is now type-enforced

**Cons:**
- Need to inspect the actual tokenManager to define accurate types
- May need to update callers if they were relying on `any` flexibility

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Infer types from tokenManager

**Approach:** Use `ReturnType<typeof this.tokenManager.validateToken>` or import types from the token manager module directly.

**Pros:**
- Types stay in sync with the implementation automatically
- No duplication

**Cons:**
- `ReturnType` can be fragile if the token manager itself uses `any`
- Less readable than explicit interfaces

**Effort:** 30 minutes

**Risk:** Medium (depends on tokenManager's type quality)

---

### Option 3: Add runtime validation with Zod

**Approach:** Define Zod schemas for the token validation result and parse the tokenManager output before returning.

**Pros:**
- Runtime AND compile-time safety
- Catches data corruption or unexpected formats
- Schema can be shared with other consumers

**Cons:**
- Additional dependency usage in a hot path
- More code than simple type annotations

**Effort:** 2-3 hours

**Risk:** Low

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/mcp-server-runtime/token-validator.ts` lines 74, 91
- All callers of `validateToken()` and `listTokens()` (search for `tokenValidator.validate` and `tokenValidator.list`)

**Related components:**
- Token manager (underlying implementation)
- Request handlers (primary consumer of validation results)
- HTTP server authentication middleware

## Acceptance Criteria

- [ ] `validateToken()` has an explicit, non-`any` return type
- [ ] `listTokens()` has an explicit, non-`any[]` return type
- [ ] All callers compile without `any` casts or assertions
- [ ] `pnpm typecheck` passes with no new errors
- [ ] Token validation behavior unchanged (same properties, same values)
- [ ] Security-critical branching on `.isValid` is type-safe

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Code Review

**Actions:**
- Identified `any` return types on security-critical token validation methods
- Confirmed callers access properties without type narrowing
- Assessed impact on refactoring safety

**Learnings:**
- The `any` types likely originate from the underlying token manager -- fixing the validator may require also typing the manager

## Resources

### 2026-02-19 - Backlog Closure

**By:** Codex

**Disposition:** already-fixed

**Notes:** Verified the issue is already addressed in current main branch code; no additional patch required in this pass.
