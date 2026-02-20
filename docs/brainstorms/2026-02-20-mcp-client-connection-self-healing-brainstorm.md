---
title: MCP Client Connection Self-Healing
status: draft
date: 2026-02-20
tags: [mcp, reliability, sessions, reconnect, client-compatibility]
---

# MCP Client Connection Self-Healing Brainstorm

## What We're Building

A reliability layer so running MCP clients recover gracefully when MCP Router restarts, with minimal or zero manual intervention.

Goal state:
- Automatic recovery when client protocol/SDK supports it.
- Universal best-effort behavior across mixed clients.
- Rock-solid operator experience via clear health state, retries, and actionable recovery guidance.

## Why This Matters

Today, router restarts can break active client sessions. Some clients reconnect automatically; others do not. In real workflows (multiple clients open, no ability to restart them), this creates downtime and confusion.

We want one consistent UX:
- Router comes back
- clients either recover automatically
- or are guided through deterministic recovery (including agent-triggerable reconnect where possible)

## Repo Context (Light Research)

Observed in current codebase:
- Strong reconnect for router -> upstream servers exists (`reconnecting-mcp-client`).
- Client -> router side is session-based (`mcp-session-id`) and recovery likely depends on each client implementation.
- Runtime already has event bridge and listChanged notifications; this is a good foundation for reconnection/state signaling.

## Approaches

### Approach A (Recommended): Adaptive Self-Healing Core + Capability-Aware Fallback

Build a unified client-session resilience layer that always retries with exponential backoff + jitter, tracks per-client recovery state, and emits machine-readable recovery hints. If a client supports auto reconnect/session renewal, recovery is automatic. If not, router surfaces explicit, agent-readable instructions and reconnect actions.

Pros:
- Balances universality and reliability.
- Works with heterogeneous client capabilities.
- Keeps behavior deterministic and observable.

Cons:
- Requires client capability detection/modeling.
- More state-machine complexity.

Best for:
- Your exact requirement: automatic + universal + rock-solid.

### Approach B: Strict Automatic Reconnect Only

Optimize only for clients that natively support reconnection/session renegotiation. Unsupported clients are marked degraded without richer fallback UX.

Pros:
- Simpler implementation.
- Fastest path for top-tier clients.

Cons:
- Leaves gaps for unsupported clients.
- Not universal in practice.

Best for:
- Teams prioritizing implementation speed over broad compatibility.

### Approach C: Compatibility-First Guidance Layer

Focus on best-effort detection and human/agent guidance (status, instructions, one-click actions), with limited core protocol reconnection logic.

Pros:
- Broad compatibility quickly.
- Lower protocol complexity.

Cons:
- Less truly automatic recovery.
- May still require user involvement often.

Best for:
- Environments with many legacy/inflexible clients.

## Recommendation

Choose Approach A.

Why:
- It is the only option that can satisfy your combined goal of automatic behavior, universal coverage, and high reliability.
- It gracefully handles hard client limitations without pretending they don’t exist.
- It creates a future-proof reliability contract: auto-heal first, guided recovery second.

## Key Decisions

- Prefer an adaptive model over a one-size-fits-all reconnect strategy.
- Always keep trying with exponential backoff and jitter before declaring degraded state.
- Surface machine-readable recovery hints so agents can self-recover where client tooling allows.
- Treat unsupported clients as first-class: provide deterministic guidance, not silent failure.

## Resolved Questions

- Q: What should happen when client auto-reconnect is unsupported?
  A: Keep retrying with backoff, then surface actionable recovery instructions; expose an agent-triggerable reconnect path when possible.

## Success Criteria (Product-Level)

- After router restart, supported clients recover without manual restart.
- Unsupported clients enter clear degraded state with actionable recovery path.
- Recovery status is observable per client (healthy/reconnecting/degraded/manual-required).
- Agents can discover and execute reconnect guidance where supported.

## Risks / Constraints

- Some clients may fundamentally not support remote-triggered reconnect.
- Session semantics differ by client and SDK behavior.
- Over-aggressive retries can cause noisy loops unless bounded and observable.

## Next Step

Move to `/prompts:workflows-plan` to define concrete design, capability matrix, APIs, and rollout/testing strategy.
