---
status: pending
priority: p3
issue_id: "005"
tags: [ui, code-quality, patterns]
dependencies: []
---

# Standardize UI Components

## Problem Statement

Several UI components use raw HTML elements or manual styling instead of using the shared `@mcp_router/ui` library. This leads to inconsistent styling and maintenance overhead.

## Findings

- **Raw Labels**: `Settings.tsx` uses `<label className="...">` instead of `<Label>`.
- **Manual Spinners**: `ActivityHeatmap.tsx` and `QueryWordCloud.tsx` use manual div spinners.
- **Missing Components**: Search input with "clear" button is duplicated/manual.

## Proposed Solutions

### Solution A: Refactor to Shared Components

- Replace `<label>` with `<Label>`
- Replace manual spinners with `Loader2` from lucide-react (or shared Spinner).
- Extract `SearchInput` to `packages/ui`.

## Acceptance Criteria

- [ ] `Settings.tsx` uses `<Label>`.
- [ ] Heatmap and WordCloud use standard loader.
- [ ] `MarketplaceSearch.tsx` logic is reviewed for centralization.

## Work Log

- 2026-02-03: Identified during Pattern Recognition Review.
