---
status: complete
priority: p2
issue_id: "135"
tags: [code-review, documentation, agent-native, quality]
dependencies: []
---

# Add Agent-Native Practices To Repository Guide

`AGENTS.md` documents contributor workflows but does not define agent-native parity expectations for contributors.

## Problem Statement

The new contributor guide covers structure, commands, style, testing, PRs, and security, but it does not explain how contributors should preserve agent-native behavior (action parity, context parity, and shared workspace expectations). This creates a documentation gap where new features can unintentionally be human-only.

## Findings

- `AGENTS.md:1` through `AGENTS.md:47` has no section describing agent-native requirements.
- Parallel review (`agent-native-reviewer`) flagged this as a must-fix architecture/documentation gap.
- Existing institutional learnings emphasize agent parity as a repeated review hotspot:
  - `docs/solutions/code-quality/REVIEW_QUICK_START.md`
  - `docs/solutions/code-quality/codebase-review-institutional-knowledge.md`

## Proposed Solutions

### Option 1: Add a concise Agent-Native Practices section to `AGENTS.md` (recommended)

**Approach:** Add a focused section that defines parity requirements and minimum checks for new features.

**Pros:**
- Fixes the gap in the same document contributors already read
- Low implementation effort
- Easy to review and maintain

**Cons:**
- Adds some length to a deliberately concise guide

**Effort:** Small (30-60 minutes)

**Risk:** Low

---

### Option 2: Link to a separate deep-dive doc and keep `AGENTS.md` brief

**Approach:** Add a short summary in `AGENTS.md` and link to a dedicated `docs/` page for agent-native policy.

**Pros:**
- Keeps contributor guide compact
- Allows richer examples and checklists

**Cons:**
- Two-doc maintenance burden
- Risk that contributors skip the linked doc

**Effort:** Medium (1-2 hours)

**Risk:** Medium

---

### Option 3: Enforce with CI-only checks, no guide update

**Approach:** Add review automation checks but do not update contributor documentation.

**Pros:**
- Automated enforcement

**Cons:**
- Does not educate contributors
- Harder for humans to reason about failures

**Effort:** Medium (2-4 hours)

**Risk:** Medium

## Recommended Action

Implemented directly in `AGENTS.md` by adding a concise `Agent-Native Practices` section and parity validation guidance for UI, CLI/package, and docs changes.

## Technical Details

**Affected files:**
- `AGENTS.md`

**Related components:**
- Contributor workflow documentation
- Multi-agent review process documentation

**Database changes:**
- None

## Resources

- `AGENTS.md:1`
- `docs/solutions/code-quality/REVIEW_QUICK_START.md`
- `docs/solutions/code-quality/codebase-review-institutional-knowledge.md`
- `docs/solutions/code-quality/comprehensive-review-35-findings.md`

## Acceptance Criteria

- [x] `AGENTS.md` includes an `Agent-Native Practices` section
- [x] Section defines action parity and context parity expectations
- [x] Section references shared workspace assumptions (no agent-only silo)
- [x] Section describes where to validate tool/prompt parity during review
- [x] Changes are reviewed by at least one agent-native reviewer

## Work Log

### 2026-02-20 - Review Finding Captured

**By:** Codex (`workflows-review` synthesis)

**Actions:**
- Ran parallel reviewers including `agent-native-reviewer`
- Confirmed contributor guide lacks explicit agent-native guidance
- Mapped finding into structured todo with options and acceptance criteria

**Learnings:**
- Documentation changes can create parity regressions even without code changes
- Agent-native checkpoints should be explicit in contributor-facing guidance

### 2026-02-20 - Implementation Completed

**By:** Codex

**Actions:**
- Updated `AGENTS.md` with an `Agent-Native Practices` section
- Added explicit parity review checkpoints for `apps/electron`, `apps/cli`/`packages/*`, and docs changes
- Kept contributor guide concise and within 200-400 word target

**Learnings:**
- Parity guidance can be captured with a short policy section without expanding doc scope

## Notes

- This finding is documentation/process quality, not a runtime bug.
