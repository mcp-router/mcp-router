---
status: pending
priority: p2
issue_id: "002"
tags: [refactoring, architecture, ui]
dependencies: []
---

# Refactor Home Component Monolith

## Problem Statement

`apps/electron/src/renderer/components/Home.tsx` has grown into a monolithic component (approx 1000 lines). It violates the Single Responsibility Principle by mixing complex state management, business logic (filtering/sorting), and UI rendering.

## Findings

- **Size**: ~1000 lines of code.
- **Responsibilities**: Handles grid/list views, search filtering, project settings modals, delete confirmations, and data fetching.
- **Coupling**: Subscribes to 5 different stores (`server`, `workspace`, `auth`, `view-preferences`, `project`).

## Proposed Solutions

### Solution A: Extract Sub-Components

Break `Home.tsx` into:

- `ServerList.tsx` / `ServerGrid.tsx`
- `HomeHeader.tsx` (controls)
- `ServerFilter.tsx`
- `ProjectSettingsModal.tsx` (already exists, but check usage)

### Solution B: Custom Hooks

Extract logic into `useServerFiltering`, `useHomeActions`.

## Acceptance Criteria

- [ ] `Home.tsx` is reduced to < 200 lines (mainly layout composition).
- [ ] Logic extracted to custom hooks or sub-components.
- [ ] No regression in functionality (search, sort, view switching).

## Work Log

- 2026-02-03: Identified during GUI Structure Review.
