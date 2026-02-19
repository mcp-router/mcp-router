---
status: complete
priority: p2
issue_id: "120"
tags: [code-review, dead-code, simplicity]
dependencies: []
---

# AuditLogService is Effectively Dead Code

AuditLogService has 6 domain-specific log methods that are never called from anywhere in the codebase. The entire audit log feature is effectively dead code with no callers writing to the audit log.

## Problem Statement

`audit-log.service.ts` (159 lines) defines domain-specific logging methods:
- `logServerAction()`
- `logSettingsChange()`
- `logTokenAction()`
- `logWorkspaceAction()`
- `logAuthAction()`
- `logProjectAction()`

None of these methods are called from any other file in the codebase. The only reference to the audit log service is a `require()` call in `system-server.ts` (line 1031), which itself may be unreachable or incomplete. This means:
1. No audit trail is being recorded despite the feature existing.
2. 159 lines of code are maintained, compiled, and reviewed without providing value.
3. The audit log tables (if created) remain empty.
4. Any compliance or security audit that depends on this feature is silently broken.

## Findings

- `apps/electron/src/main/modules/mcp-logger/audit-log.service.ts` defines 6 log methods:
  - Line 68: `logServerAction()`
  - Line 76: `logSettingsChange()`
  - Line 87: `logTokenAction()`
  - Line 95: `logWorkspaceAction()`
  - Line 103: `logAuthAction()`
  - Line 118: `logProjectAction()`
- Grep for all 6 method names across the entire codebase returns results ONLY in the audit-log.service.ts file itself.
- No callers exist in any service, IPC handler, or repository.
- The `require()` in `system-server.ts` line 1031 references the module but the actual log methods are never invoked.

**Location:**
- `apps/electron/src/main/modules/mcp-logger/audit-log.service.ts` (159 lines, all dead)

## Proposed Solutions

### Option 1: Remove dead code until needed (recommended)

**Approach:** Delete `audit-log.service.ts` and any related dead infrastructure (tables, types, exports). If audit logging is needed in the future, it can be rebuilt with the benefit of knowing the actual requirements.

**Pros:**
- Reduces maintenance burden
- Eliminates false sense of audit coverage
- Simplifies the codebase
- Can be restored from git history if needed

**Cons:**
- Loses the implementation as a starting point (mitigated by git history)
- If audit logging is needed soon, need to rewrite

**Effort:** 30 minutes

**Risk:** Low

---

### Option 2: Wire up audit log callers at integration points

**Approach:** Add calls to the audit log methods at the appropriate integration points:
- Server add/remove/update in `mcp-server-manager.service.ts`
- Settings changes in `workspace.service.ts`
- Token create/revoke in token management
- Auth events in `auth.service.ts`
- Project changes in `projects.service.ts`

**Pros:**
- Activates the audit log feature
- Provides compliance and security audit trail
- Uses existing implementation

**Cons:**
- Significant effort to wire up all integration points
- Need to verify the audit log storage and query paths work
- May surface additional bugs in the audit log implementation

**Effort:** 4-6 hours

**Risk:** Medium

---

### Option 3: Archive behind a feature flag

**Approach:** Keep the code but gate it behind a feature flag. Document that audit logging is not active. Enable it when ready to invest in the full integration.

**Pros:**
- No code deletion
- Clear documentation of feature state
- Easy to activate later

**Cons:**
- Still carries maintenance burden
- Feature flag infrastructure may not exist
- Perpetuates dead code with extra indirection

**Effort:** 1 hour

**Risk:** Low

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/mcp-logger/audit-log.service.ts` (159 lines)
- `apps/electron/src/main/modules/system-server/system-server.ts` line 1031 (require reference)
- Any audit log repository or database table definitions

**Related components:**
- Server manager service (potential caller for server actions)
- Workspace service (potential caller for settings changes)
- Auth service (potential caller for auth actions)
- Token management (potential caller for token actions)
- Projects service (potential caller for project actions)

## Acceptance Criteria

**If removing (Option 1):**
- [ ] `audit-log.service.ts` is deleted
- [ ] All references to audit log service are removed
- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` succeeds
- [ ] No runtime errors from missing module

**If wiring up (Option 2):**
- [ ] All 6 log methods are called from appropriate integration points
- [ ] Audit log entries are persisted to the database
- [ ] Audit log entries can be queried
- [ ] Audit log entries contain meaningful data (action, actor, timestamp, details)

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Code Review

**Actions:**
- Grep for all 6 audit log method names found zero callers outside the service itself
- Confirmed the service is 159 lines of dead code
- Reviewed the `require()` reference in system-server.ts
- Assessed compliance implications of missing audit trail

**Learnings:**
- The feature was likely implemented speculatively and never integrated
- The `require()` in system-server.ts suggests partial integration was attempted

## Resources

### 2026-02-19 - Backlog Closure

**By:** Codex

**Disposition:** already-fixed

**Notes:** Verified the issue is already addressed in current main branch code; no additional patch required in this pass.
