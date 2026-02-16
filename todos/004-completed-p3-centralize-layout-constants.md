---
status: pending
priority: p3
issue_id: "004"
tags: [ui, maintainability, css]
dependencies: []
---

# Centralize Layout Constants

## Problem Statement

The TitleBar height (`50px`) and related padding/offsets are hardcoded in multiple files. Changing the header height requires manual updates in at least 3 locations.

## Findings

- **Locations**:
  - `TitleBar.tsx`: `h-[50px]`
  - `App.tsx`: `pt-[50px]`
  - `Sidebar.tsx`: `pt-[50px]`
- **Risk**: Visual bugs if one value is updated but others are missed.

## Proposed Solutions

### Solution A: CSS Variables

Define `--titlebar-height: 50px` in `globals.css` and use `h-[var(--titlebar-height)]`.

### Solution B: Shared Constant

Export `TITLEBAR_HEIGHT` from a constants file.

## Acceptance Criteria

- [ ] Define single source of truth for TitleBar height.
- [ ] Replace hardcoded values in `TitleBar`, `App`, and `Sidebar`.

## Work Log

- 2026-02-03: Identified during GUI Structure Review.
