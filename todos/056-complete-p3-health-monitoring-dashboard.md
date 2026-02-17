---
status: complete
priority: p3
issue_id: "056"
tags: [strategic, devex, observability]
dependencies: []
---

# No Server Health Monitoring Dashboard

## Problem Statement

MCP Router has connection health detection and auto-reconnect (three-layer architecture: ConnectionMonitor, HealthChecker, ReconnectingMCPClient) and SSE events for real-time status. However, there is no aggregate health dashboard with historical uptime tracking, alerting/notifications when servers go down, or SLA monitoring.

Users managing many servers (10+) have no way to see overall system health at a glance or track reliability trends over time.

## Findings

- **Current state:** Server status icons in list/grid view, SSE events for real-time changes, request log with duration metrics
- **What's missing:** Aggregate health dashboard, historical uptime percentages, server latency graphs, alerting (desktop notifications, webhooks), SLA monitoring
- **Competitors:** MCPHub/samanhappy (real-time server events), Docker MCP (health monitoring via Docker Desktop), Enterprise gateways (full observability stacks)
- **User need:** As server count grows, proactive monitoring becomes essential

**Identified by:** Strategic Competitive Analysis

## Proposed Solutions

### Option A: Built-in health dashboard (Recommended)
- New "Health" or "Monitoring" tab in the main UI
- Server uptime percentages (24h, 7d, 30d)
- Average response latency per server
- Tool call success/failure rates
- Desktop notifications for server failures
- **Effort:** Medium (1-2 weeks) | **Risk:** Low (data already collected, needs visualization)

### Option B: Webhook-based alerting
- Add webhook endpoints for server status change notifications
- Integrate with Slack, Discord, PagerDuty, etc.
- **Effort:** Small (3-5 days) | **Risk:** Low

## Acceptance Criteria

- [ ] Dashboard shows aggregate health status for all servers
- [ ] Historical uptime data is tracked and visualized
- [ ] Desktop notifications fire on server failures
- [ ] Response latency trends are visible per server

## Work Log

| Date | Action |
|------|--------|
| 2026-02-17 | Created from strategic competitive analysis review |
