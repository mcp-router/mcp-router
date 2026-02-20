---
title: feat: Selective tool catalog mode with per-client overrides
type: feat
status: active
date: 2026-02-20
---

# feat: Selective tool catalog mode with per-client overrides

## Overview
Add selective tool catalog behavior so MCP Router can keep a global default while allowing per-client overrides (e.g., Cursor on catalog mode, Claude Desktop off catalog mode).

## Problem Statement / Motivation
Today `toolCatalogEnabled` is effectively global. This forces one behavior for all clients, even though client MCP behavior differs. Some clients are more reliable with catalog tools, while others work better with full direct tool listing.

## Proposed Solution
Implement a layered setting resolution model:
1. Global default (`toolCatalogEnabled`)
2. Per-client override map (`toolCatalogOverridesByClient`)
3. Effective behavior per request resolved as:
   - if override exists for normalized `clientId`: use override
   - else: fallback to global default

This affects:
- Tool listing behavior (`tools/list`)
- Legacy tool-call gating when catalog mode is on
- System tools for reading/updating settings
- Settings UI controls

## Local Research Summary

### Repository conventions and existing patterns
- Global shared settings are defined in `packages/shared/src/types/settings-types.ts`.
- Runtime catalog toggle check currently reads from global shared config in `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts:177`.
- System settings tools already expose global settings read/write in `apps/electron/src/main/modules/system-server/system-server.ts:448` and `apps/electron/src/main/modules/system-server/system-server.ts:451`.
- Settings page currently exposes a single global catalog toggle in `apps/electron/src/renderer/components/setting/Settings.tsx:645`.

### Institutional learnings (docs/solutions)
- `docs/solutions/` currently contains code-review institutional docs only (`docs/solutions/code-quality/*`), with no feature-specific prior for tool-catalog selectivity.

### External research decision
Skipped. This is an internal feature with strong local patterns and low external-API risk.

## SpecFlow-style Gap Analysis
- Flow completeness gap: no per-client layer in settings model.
- Edge-case gap: unknown/empty client IDs should deterministically fallback to global default.
- UX gap: no discoverable way in UI to set per-client behavior.
- API gap: `router_get_settings`/`router_update_settings` do not yet model overrides.
- Validation gap: no tests for fallback/override precedence.

## Technical Considerations
- Backward compatibility:
  - Existing `toolCatalogEnabled` behavior remains default fallback.
  - Existing settings files without override map continue working unchanged.
- Normalization:
  - Normalize client IDs before lookup (trim + lowercase), consistent with existing client handling in request pipeline.
- Safety:
  - If override map is malformed or contains unknown clients, ignore invalid entries rather than failing runtime.

## System-Wide Impact
- **Interaction graph**:
  - `tools/list` request -> resolve `clientId` -> resolve effective catalog mode -> return meta-tools or full tool list.
  - `tools/call` request -> resolve effective catalog mode -> if catalog enabled, allow only meta/system tools + route via `tool_execute`.
- **Error propagation**:
  - Settings validation errors should be surfaced from `router_update_settings` as invalid request errors.
- **State lifecycle risks**:
  - Persisting override map in shared config must be atomic with existing settings save path.
- **API surface parity**:
  - UI settings, system tools, and runtime resolver must agree on the same field names and normalization rules.
- **Integration test scenarios**:
  - Same tool request from two different clients yields different listing mode by override.

## Implementation Plan

### Phase 1: Settings schema and storage
- [ ] Extend `AppSettings` with per-client override map.
  - File: `packages/shared/src/types/settings-types.ts`
  - Proposed shape:
    - `toolCatalogOverridesByClient?: Record<string, boolean>`
- [ ] Add defaults and docs comments for new field.
- [ ] Ensure shared config manager can read/write this field without migration breakage.
  - Files likely touched:
    - `apps/electron/src/main/infrastructure/shared-config-manager.ts`

### Phase 2: Runtime resolution and behavior
- [ ] Add helper in request handlers:
  - `getEffectiveToolCatalogEnabled(clientId: string): boolean`
  - Resolution order: override -> global default.
  - File: `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts`
- [ ] Thread effective mode into:
  - `handleListTools(...)`
  - `handleCallTool(...)`
- [ ] Keep existing fallback behavior for unknown/missing `clientId`.

### Phase 3: System tool API exposure
- [ ] Add read support for override map in `router_get_settings` response.
  - File: `apps/electron/src/main/modules/system-server/system-server.ts`
- [ ] Add write support and validation in `router_update_settings`.
  - Accept partial patch updates for override map.
  - Validate keys and boolean values.
- [ ] Update tool schemas/types for settings API.
  - Files:
    - `apps/electron/src/main/modules/system-server/system-server.types.ts`
    - `packages/shared/src/types/platform-api/domains/settings-api.ts` (if required)

### Phase 4: UI controls
- [ ] Add global default section (existing toggle retained).
- [ ] Add per-client override editor UI:
  - List known clients and tri-state behavior per client:
    - `inherit default`
    - `force catalog on`
    - `force catalog off`
- [ ] Persist overrides via `platformAPI.settings.save(...)`.
  - File: `apps/electron/src/renderer/components/setting/Settings.tsx`
- [ ] Add i18n strings for new labels/help text.
  - File: `apps/electron/src/locales/en.json`

### Phase 5: Tests
- [ ] Runtime unit tests for precedence:
  - global true + no override => true
  - global false + override true => true
  - global true + override false => false
  - malformed override entry => fallback to global
- [ ] System tool tests:
  - `router_get_settings` returns override map.
  - `router_update_settings` updates/validates override map.
- [ ] UI tests (or component tests) for tri-state controls and persistence behavior.

## Acceptance Criteria
- [ ] A per-client override map exists in shared settings and persists correctly.
- [ ] Effective catalog mode resolves as override first, global fallback second.
- [ ] `tools/list` and `tools/call` behavior uses effective per-client mode.
- [ ] `router_get_settings` exposes overrides.
- [ ] `router_update_settings` can update overrides with validation.
- [ ] Settings UI allows editing global default and per-client overrides.
- [ ] Automated tests cover fallback/override precedence and invalid input handling.

## Success Metrics
- Different clients can reliably operate with different catalog modes in the same app session.
- Reduction in client-specific MCP discovery failures without regressing clients that prefer direct tool listing.
- No breaking change for existing users with only global settings configured.

## Dependencies & Risks
- Dependency: stable client ID resolution from request metadata/token path.
- Risk: client naming drift (`cursor` vs `Cursor` etc.) causing missed overrides.
  - Mitigation: strict normalization and documented canonical IDs.
- Risk: UI complexity from tri-state controls.
  - Mitigation: keep first release minimal with compact table and clear helper text.

## References & Research
- Global settings model: `packages/shared/src/types/settings-types.ts`
- Runtime catalog toggle check: `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts:177`
- Settings tools definitions: `apps/electron/src/main/modules/system-server/system-server.ts:1454`
- Settings tools handlers: `apps/electron/src/main/modules/system-server/system-server.ts:448`
- Current UI global toggle: `apps/electron/src/renderer/components/setting/Settings.tsx:645`
- Institutional docs reviewed: `docs/solutions/code-quality/REVIEW_QUICK_START.md`

## MVP Pseudocode

### `apps/electron/src/main/modules/mcp-server-runtime/request-handlers.ts`
```ts
private getEffectiveToolCatalogEnabled(clientId: string): boolean {
  const settings = getSharedConfigManager().getSettings();
  const normalized = clientId.trim().toLowerCase();
  const overrides = settings.toolCatalogOverridesByClient ?? {};
  if (normalized in overrides) return overrides[normalized] === true;
  return settings.toolCatalogEnabled === true;
}
```

### `packages/shared/src/types/settings-types.ts`
```ts
export interface AppSettings {
  toolCatalogEnabled?: boolean;
  toolCatalogOverridesByClient?: Record<string, boolean>;
}
```

## Final Review Checklist
- [ ] Title is descriptive and searchable.
- [ ] Plan includes concrete file targets.
- [ ] Acceptance criteria are testable.
- [ ] No model/ERD changes required.
- [ ] Plan is implementation-ready for `/prompts:workflows-work`.
