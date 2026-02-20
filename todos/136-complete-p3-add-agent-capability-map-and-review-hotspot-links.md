---
status: complete
priority: p3
issue_id: "136"
tags: [code-review, documentation, agent-native, process]
dependencies: ["135"]
---

# Add Agent Capability Map And Review Hotspot Links

The contributor guide currently omits a lightweight capability map and links to known high-risk review patterns.

## Problem Statement

Without a simple "UI action -> agent tool -> prompt/context reference" map, reviewers cannot quickly verify agent parity during docs or feature reviews. The current guide also misses links to existing institutional review checklists, which increases the chance of repeated oversight.

## Findings

- `AGENTS.md:1` through `AGENTS.md:47` does not provide a capability map reference.
- `learnings-researcher` surfaced existing review playbooks that should be linked for contributor context:
  - `docs/solutions/code-quality/REVIEW_QUICK_START.md`
  - `docs/solutions/code-quality/comprehensive-review-19-findings.md`
  - `docs/solutions/code-quality/comprehensive-review-35-findings.md`
- `docs/solutions/patterns/critical-patterns.md` appears missing, suggesting discoverability gaps for "must-check" review patterns.

## Proposed Solutions

### Option 1: Add a compact capability map checklist inline (recommended)

**Approach:** Add 4-6 bullets or a small table in `AGENTS.md` that reviewers can use to verify parity.

**Pros:**
- Fast parity checks for contributors and reviewers
- Minimal documentation overhead

**Cons:**
- Must be updated as features evolve

**Effort:** Small (30-45 minutes)

**Risk:** Low

---

### Option 2: Add references-only section to existing review docs

**Approach:** Add links to review hotspot docs but skip capability mapping.

**Pros:**
- Very quick
- Improves discoverability of existing materials

**Cons:**
- Still leaves parity verification implicit

**Effort:** Small (20-30 minutes)

**Risk:** Low

---

### Option 3: Build a generated capability inventory

**Approach:** Generate a map from code metadata and publish it in docs.

**Pros:**
- Strong long-term consistency
- Reduced manual drift

**Cons:**
- Higher implementation complexity
- Requires ownership and maintenance

**Effort:** Large (1-2 days)

**Risk:** Medium

## Recommended Action

Implemented by adding concise parity validation bullets in `AGENTS.md` plus direct links to institutional review references under `docs/solutions/code-quality/`.

## Technical Details

**Affected files:**
- `AGENTS.md`
- Optional follow-up: `docs/solutions/code-quality/REVIEW_QUICK_START.md`

**Related components:**
- Contributor documentation workflow
- Code review onboarding process

**Database changes:**
- None

## Resources

- `AGENTS.md:1`
- `docs/solutions/code-quality/REVIEW_QUICK_START.md`
- `docs/solutions/code-quality/codebase-review-institutional-knowledge.md`
- `docs/solutions/code-quality/comprehensive-review-19-findings.md`
- `docs/solutions/code-quality/comprehensive-review-35-findings.md`

## Acceptance Criteria

- [x] `AGENTS.md` includes a capability-map-style parity check
- [x] Guide links to at least one institutional review checklist under `docs/solutions/code-quality/`
- [x] Capability map language is concise and actionable for reviewers
- [x] Reviewers can identify agent parity checkpoints in under 60 seconds

## Work Log

### 2026-02-20 - Review Finding Captured

**By:** Codex (`workflows-review` synthesis)

**Actions:**
- Consolidated findings from `agent-native-reviewer` and `learnings-researcher`
- Added dependency on issue `135` (base agent-native section)
- Created structured todo with alternatives and measurable acceptance criteria

**Learnings:**
- Knowledge exists in `docs/solutions/code-quality`, but discoverability from contributor guide is low
- Small checklist links can prevent repetitive review misses

### 2026-02-20 - Implementation Completed

**By:** Codex

**Actions:**
- Added concise parity check guidance in `AGENTS.md` for common change areas
- Added a `Review References` section linking core institutional knowledge docs
- Confirmed guide remains concise and readable after additions

**Learnings:**
- Lightweight doc links substantially improve discoverability without adding process overhead

## Notes

- This is an improvement item and does not block current functionality.
