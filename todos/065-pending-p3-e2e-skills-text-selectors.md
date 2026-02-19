---
status: pending
priority: p3
issue_id: "065"
tags: [code-review, quality, testing, e2e]
dependencies: []
---

# E2E Skills Tests Use Text-Only Selectors (Flaky)

Recent edits to `skills.spec.ts` rely on generic text selectors like `"Skills"`, which are brittle and can match multiple elements. This increases test flakiness and false positives.

## Problem Statement

The E2E tests for the Skills flow may click or assert against unintended elements when multiple nodes contain the same text, leading to nondeterministic failures.

## Findings

- Replaced stable selectors with broad text matches (e.g., `page.click('"Skills"')`).
- Several assertions now only check text without scoping to the Skills view.

**Location:**
- `apps/electron/e2e/specs/skills.spec.ts`

## Proposed Solutions

### Option 1: Restore data-testid selectors

**Approach:** Reintroduce `data-testid` attributes and target them in tests.

**Pros:**
- Most stable selectors
- Clear intent

**Cons:**
- Requires UI markup changes if testids were removed

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Use role-based + scoped selectors

**Approach:** Use `getByRole` or scoped locators within a known container to limit matches.

**Pros:**
- Less coupling to implementation details
- Avoids adding new attributes

**Cons:**
- Still less stable than explicit test ids

**Effort:** 1-2 hours

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `apps/electron/e2e/specs/skills.spec.ts`

## Resources

- **Branch:** current `main` local working tree

## Acceptance Criteria

- [ ] Test selectors uniquely target Skills UI elements
- [ ] Tests pass consistently across multiple runs

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Codex

**Actions:**
- Reviewed updated selectors and identified broad text matches
- Documented stabilization options

**Learnings:**
- Text-only selectors tend to become flaky as UI grows

