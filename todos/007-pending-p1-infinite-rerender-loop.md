---
status: pending
priority: p1
issue_id: "007"
tags: [code-review, bug, react, performance]
dependencies: []
---

# Infinite Re-render Loop in SkillsManager useEffect

## Problem Statement

The `useEffect` in `SkillsManager.tsx` (lines 205-212) includes `selectedSkill` in its dependency array while also calling `setSelectedSkill(updated)` inside the effect. Since `updated` is always a new object reference from the `unifiedSkills` array after each `loadData`, this creates a render loop.

## Findings

- **Location**: `apps/electron/src/renderer/components/skills/SkillsManager.tsx` lines 205-212
- **Pattern**: `setSelectedSkill(updated)` mutates `selectedSkill`, which is a dependency of the same useEffect
- **Impact**: Potential 100% CPU utilization in renderer when a skill is selected, causing UI freezes
- **Flagged by**: Performance oracle (CRITICAL), TypeScript reviewer (HIGH), Architecture reviewer (noted as fragile)

## Proposed Solutions

### Solution A: Store ID Instead of Object (Recommended)

```tsx
const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
const selectedSkill = useMemo(
  () => unifiedSkills.find(s => s.id === selectedSkillId) ?? null,
  [unifiedSkills, selectedSkillId],
);
```

- **Pros**: Eliminates the effect entirely, no loop possible, cleaner pattern
- **Effort**: Small
- **Risk**: Low

### Solution B: Remove selectedSkill from Dependencies

- **Pros**: Quick fix, minimal change
- **Cons**: ESLint suppression needed, stale closure risk
- **Effort**: Small
- **Risk**: Low-Medium

## Acceptance Criteria

- [ ] No useEffect has state setters that modify their own dependencies
- [ ] Selected skill syncs correctly when unifiedSkills updates
- [ ] No excessive re-renders visible in React DevTools

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-05 | Identified by Performance oracle and TypeScript reviewer | Classic React anti-pattern |

## Resources

- File: apps/electron/src/renderer/components/skills/SkillsManager.tsx:205-212
