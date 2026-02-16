---
status: completed
priority: p1
issue_id: "021"
tags: [code-review, security, xss]
dependencies: []
---

# Unsanitized SVG Injection in ClientApps.tsx

## Problem Statement

`ClientApps.tsx` uses `dangerouslySetInnerHTML` to inject `client.icon` SVG content **without** passing through the `sanitizeSvg` function. While icons currently come from hardcoded `ICON_MAP`, this is a defense-in-depth failure. Other components (`ClientStatusIcon.tsx`, `UnifiedSkillDetailSheet.tsx`) correctly use `sanitizeSvgWithStyles()`.

## Findings

- **File:** `apps/electron/src/renderer/components/client-apps/ClientApps.tsx` lines 493-501
- Raw SVG injected with only a regex `replace` for sizing
- **Contrast:** `ClientStatusIcon.tsx` line 49 and `UnifiedSkillDetailSheet.tsx` line 355 both use `sanitizeSvgWithStyles()`

**Identified by:** Security Sentinel (CRITICAL-04)

## Proposed Solutions

### Option A: Apply sanitizeSvgWithStyles() (Recommended)
- Use the same pattern as other components
- **Effort:** Small (5 min) | **Risk:** None

## Acceptance Criteria

- [ ] `client.icon` passed through `sanitizeSvgWithStyles()` before injection
- [ ] All `dangerouslySetInnerHTML` usages in the codebase use sanitization

## Work Log

| Date | Action |
|------|--------|
| 2026-02-16 | Created from multi-agent code review |
| 2026-02-16 | Fixed by parallel resolve agents |

## Resources

- `apps/electron/src/renderer/components/client-apps/ClientApps.tsx`
- `apps/electron/src/renderer/utils/svg-sanitizer.ts`
