---
status: complete
priority: p1
issue_id: "099"
tags: [code-review, bug, agent-native, typescript]
dependencies: []
---

# System Tools Misplaced in Settings Validation Array

Five MCP tool definition objects are accidentally placed inside the `VALID_SETTING_KEYS` array instead of the `SYSTEM_TOOLS` array in `system-server.ts`. This causes settings validation to break, tools to be undiscoverable by agents, and a runtime crash in the audit log handler.

## Problem Statement

In the `router_update_settings` case handler (lines 383-449), the `VALID_SETTING_KEYS` array is intended to be a `string[]` of valid boolean setting names. Instead, it contains 5 string entries followed by 5 MCP tool definition objects (for `router_health_metrics`, `router_token_usage`, `router_audit_log`, `router_discover_servers`, `router_install_mcpb`). This produces four distinct failures:

1. **Settings validation is broken** -- `VALID_SETTING_KEYS.includes(key)` compares a string against a mixed array of strings and objects. The `.includes()` call uses strict equality, so string keys will never match the object entries, but the real issue is that the array is polluted. Any error messages calling `.join(", ")` on the array will render the objects as `[object Object]`.

2. **Error messages are garbled** -- The error thrown at line 455 does `VALID_SETTING_KEYS.join(", ")`, which produces output like `toolCatalogEnabled, prefixToolNames, ..., [object Object], [object Object], ...`.

3. **Five tools are undiscoverable** -- Because the 5 tool definitions are in `VALID_SETTING_KEYS` instead of `SYSTEM_TOOLS`, they are never returned in `ListTools` responses. Agents cannot discover or invoke `router_health_metrics`, `router_token_usage`, `router_audit_log`, `router_discover_servers`, or `router_install_mcpb`.

4. **`handleAuditLog` will crash at runtime** -- At line 1031, `handleAuditLog` uses `require()` to import `getAuditLogService` and then calls `service.queryLogs()` and `service.getLogCount()`. These methods do not exist on `AuditLogService`. The actual service only exposes logging methods (`logServerAction`, `logSettingsChange`, etc.) and has no query interface.

## Findings

**Misplaced tool definitions (lines 383-449):**
```typescript
case "router_update_settings": {
  const VALID_SETTING_KEYS = [
    "toolCatalogEnabled",
    "prefixToolNames",
    "loadExternalMCPConfigs",
    "autoUpdateEnabled",
    "showWindowOnStartup",
    {
      name: "router_health_metrics",
      description: "Get health metrics...",
      inputSchema: { type: "object" as const, properties: {} },
    },
    // ... 4 more tool definition objects
  ];
```

**Broken validation (lines 451-456):**
```typescript
for (const [key, value] of Object.entries(args)) {
  if (!VALID_SETTING_KEYS.includes(key)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Unknown setting: ${key}. Valid settings: ${VALID_SETTING_KEYS.join(", ")}`,
    );
  }
```

**Phantom method calls (lines 1031-1034):**
```typescript
const { getAuditLogService } = require("../mcp-logger/audit-log.service");
const service = getAuditLogService();
const logs = service.queryLogs({ action, actor });   // does not exist
const count = service.getLogCount({ action, actor }); // does not exist
```

`AuditLogService` (audit-log.service.ts) has no `queryLogs` or `getLogCount` methods. It only exposes `logServerAction`, `logSettingsChange`, `logTokenAction`, `logWorkspaceAction`, `logAuthAction`, `logSkillAction`, and `logProjectAction`.

**Locations:**
- `apps/electron/src/main/modules/system-server/system-server.ts` lines 383-449 (misplaced definitions)
- `apps/electron/src/main/modules/system-server/system-server.ts` lines 451-456 (broken validation)
- `apps/electron/src/main/modules/system-server/system-server.ts` lines 1026-1044 (phantom methods)
- `apps/electron/src/main/modules/mcp-logger/audit-log.service.ts` (no query methods exist)

## Proposed Solutions

### Option 1: Move tool definitions and add query methods to AuditLogService

**Approach:** Move the 5 tool definition objects from `VALID_SETTING_KEYS` to the `SYSTEM_TOOLS` array. Change `VALID_SETTING_KEYS` to be a pure `string[]`. Add `queryLogs()` and `getLogCount()` methods to `AuditLogService` backed by `AuditLogRepository`.

**Pros:**
- Fixes all four failures in one change
- Makes audit querying a first-class feature
- Straightforward refactor

**Cons:**
- Need to design the query API for AuditLogRepository (filter schema, pagination)
- Adds new surface area to the audit module

**Effort:** 2-4 hours

**Risk:** Low

---

### Option 2: Move tool definitions, replace audit handler with repository direct access

**Approach:** Move tool definitions to `SYSTEM_TOOLS`. Instead of adding methods to AuditLogService, have `handleAuditLog` query `AuditLogRepository` directly using existing SQLite query capabilities.

**Pros:**
- Faster to implement
- No new service API to design

**Cons:**
- Bypasses service layer, breaking the module's architectural pattern
- Harder to add audit query authorization later

**Effort:** 1-2 hours

**Risk:** Medium (architectural debt)

---

### Option 3: Move tool definitions, disable audit query tool until properly implemented

**Approach:** Move tool definitions to `SYSTEM_TOOLS`. Comment out or remove `router_audit_log` tool from the tools list and its handler. Add a TODO to implement it properly with a query API.

**Pros:**
- Eliminates the runtime crash immediately
- No risk of shipping broken query functionality

**Cons:**
- Removes a feature (audit querying) that agents may already reference
- Requires a follow-up ticket to re-implement

**Effort:** 30 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `apps/electron/src/main/modules/system-server/system-server.ts`
- `apps/electron/src/main/modules/mcp-logger/audit-log.service.ts`
- `apps/electron/src/main/modules/mcp-logger/audit-log.repository.ts`

**Related components:**
- System Server (agent-native MCP tools)
- Settings validation pipeline
- AuditLogService / AuditLogRepository
- MCP ListTools response

## Acceptance Criteria

- [ ] `VALID_SETTING_KEYS` contains only string entries (no objects)
- [ ] `VALID_SETTING_KEYS.join(", ")` produces a clean comma-separated list of setting names
- [ ] `router_update_settings` correctly validates and rejects unknown setting keys
- [ ] All 5 tools (`router_health_metrics`, `router_token_usage`, `router_audit_log`, `router_discover_servers`, `router_install_mcpb`) appear in `ListTools` responses
- [ ] `router_audit_log` tool invocation does not throw a runtime error
- [ ] `handleAuditLog` calls only methods that exist on the service or repository
- [ ] TypeScript compiles without errors (no phantom method references)

## Work Log

## Resources

### 2026-02-19 - Backlog Closure

**By:** Codex

**Disposition:** already-fixed

**Notes:** Verified the issue is already addressed in current main branch code; no additional patch required in this pass.
