---
status: pending
priority: p2
issue_id: "017"
tags: [code-review, security, xss]
dependencies: []
---

# SVG Sanitizer Uses Regex-Based Approach With Known Bypass Risks

## Problem Statement

The SVG sanitizer at `svg-sanitizer.ts` uses regex-based sanitization which can be bypassed with encoding tricks, newlines, CDATA sections, and parser differentials. Attack vector: malicious MCP client registration injecting crafted SVG via `clientApp.icon`.

## Proposed Solutions

### Solution A: Replace with DOMPurify (Recommended)

Use DOMPurify with SVG-specific configuration.

- **Effort**: Small
- **Risk**: Low - DOMPurify is battle-tested

## Acceptance Criteria

- [ ] SVG sanitization uses a DOM-based parser (not regex)
- [ ] Known SVG XSS vectors are blocked

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-05 | Identified by Security sentinel | Regex-based SVG sanitization is fragile |

## Resources

- File: apps/electron/src/renderer/utils/svg-sanitizer.ts
