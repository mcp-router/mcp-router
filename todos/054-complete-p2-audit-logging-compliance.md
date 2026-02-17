---
status: complete
priority: p2
issue_id: "054"
tags: [strategic, enterprise, security]
dependencies: []
---

# No Compliance-Grade Audit Logging

## Problem Statement

MCP Router has request logging (MCP request/response history) and PostHog analytics, but lacks compliance-grade audit trails. Logs can be cleared. There is no immutable log store, no export to SIEM systems, no user-action audit (who changed what configuration when), and SECURITY.md recommends removing sensitive data from logs (still pending).

For enterprise adoption, regulatory compliance (SOC 2, HIPAA, GDPR), and security incident response, immutable audit logging is a hard requirement.

## Findings

- **Current logging:** Pino-based structured logs with 30-day rotation; request logs in SQLite with cursor-based pagination
- **What's missing:** Immutable append-only log store, configuration change audit trail, SIEM export (Splunk, Datadog, etc.), sensitive data scrubbing in logs, log integrity verification
- **Competitors:** Pipedream (SOC 2 Type II, HIPAA, GDPR compliant), Docker MCP (signed images, SBOMs), Amazon Bedrock AgentCore (CloudTrail integration)
- **Market trend:** Enterprise MCP gateways compete heavily on observability and compliance

**Identified by:** Strategic Competitive Analysis

## Proposed Solutions

### Option A: Append-only audit log with SIEM export (Recommended)
- Add a separate audit log table for configuration changes (immutable, no DELETE/UPDATE)
- Record: timestamp, userId, action, target, before/after state
- Export API for SIEM integration (JSON Lines, syslog format)
- Scrub sensitive data (tokens, env vars) from all log outputs
- **Effort:** Large (2-3 weeks) | **Risk:** Low (well-understood patterns)

### Option B: External audit service integration
- Integrate with existing audit SaaS (e.g., WorkOS Audit Logs, Drata)
- Offload compliance burden to specialized service
- **Effort:** Medium (1-2 weeks) | **Risk:** Low (external dependency)

## Acceptance Criteria

- [ ] All configuration changes are recorded in an immutable audit log
- [ ] Audit log entries include actor, action, target, and timestamp
- [ ] Sensitive data is scrubbed from all log outputs
- [ ] Logs can be exported in standard formats (JSON Lines, syslog)

## Work Log

| Date | Action |
|------|--------|
| 2026-02-17 | Created from strategic competitive analysis review |
