---
status: pending
priority: p3
issue_id: "035"
tags: [code-review, security]
dependencies: []
---

# Replace Regex SVG Sanitizer with DOMPurify

## Problem Statement

The SVG sanitizer uses regex-based filtering with documented bypass vectors (HTML entity encoding, CDATA sections, parser differentials). The code itself has a `TODO: Replace with DOMPurify` comment.

## Findings

- **File:** `apps/electron/src/renderer/utils/svg-sanitizer.ts` lines 13-21
- Known bypasses: `&#106;avascript:`, CDATA script hiding, animation attribute injection

**Identified by:** Security Sentinel (MEDIUM-04)

## Proposed Solutions

Replace with DOMPurify: `DOMPurify.sanitize(svgContent, { USE_PROFILES: { svg: true } })`
- **Effort:** Small (30 min) | **Risk:** Low

## Acceptance Criteria

- [ ] Regex-based sanitizer replaced with DOMPurify
- [ ] All SVG injection points use DOMPurify-based sanitization

## Work Log

| Date | Action |
|------|--------|
| 2026-02-16 | Created from multi-agent code review |
