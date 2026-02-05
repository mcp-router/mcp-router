---
status: pending
priority: p2
issue_id: "003"
tags: [architecture, state-management, zustand]
dependencies: []
---

# Split Server Store (UI vs Data)

## Problem Statement

`server-store.ts` mixes Domain Data (servers list, status) with UI State (search query, expanded items, selected items). This causes unnecessary re-renders; components only caring about the server list might re-render when the user types in the search box.

## Findings

- **File**: `apps/electron/src/renderer/stores/server-store.ts`
- **Mixed State**: Contains `searchQuery`, `expandedServerId` alongside `servers`, `refreshServers`.
- **Risk**: Performance degradation as the app scales.

## Proposed Solutions

### Solution A: Split Stores

Create `server-data-store.ts` (synced with backend) and `server-ui-store.ts` (local UI state).

### Solution B: Slices

Keep one store but use Zustand slices pattern more strictly (less effective for re-render prevention unless selectors are strict).

## Acceptance Criteria

- [ ] Create `useServerUIStore` for search/selection state.
- [ ] Remove UI state from `useServerStore`.
- [ ] Update `Home.tsx` (and refactored components) to use the correct store.

## Work Log

- 2026-02-03: Identified during State Management Review.
