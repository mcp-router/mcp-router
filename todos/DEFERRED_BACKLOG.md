# Deferred Backlog

Last updated: 2026-02-19

This index tracks todos intentionally deferred (not implemented yet).

## Quick Commands

- List deferred pending items:
  `grep -RIl "\*\*Disposition:\*\* deferred-" /Users/robdezendorf/Documents/GitHub/mcp-router/todos/*-pending-*.md | sort`
- Count deferred pending items:
  `grep -RIl "\*\*Disposition:\*\* deferred-" /Users/robdezendorf/Documents/GitHub/mcp-router/todos/*-pending-*.md | wc -l`

## Deferred Strategic (8)

- 047 - `todos/047-pending-p1-desktop-only-architecture.md` - Desktop-Only Architecture Limits Deployment Scenarios
- 048 - `todos/048-pending-p1-no-multi-user-team-support.md` - No Multi-User or Team Support
- 049 - `todos/049-pending-p2-no-rbac-sso-enterprise-auth.md` - No RBAC, SSO/SAML, or Enterprise Auth
- 052 - `todos/052-pending-p2-no-server-testing-debugging-ui.md` - No MCP Server Testing/Debugging UI
- 053 - `todos/053-pending-p2-cloud-search-phase-2.md` - Tool Catalog Cloud Search (Phase 2) Not Implemented
- 055 - `todos/055-pending-p3-plugin-extension-api.md` - No Plugin/Extension API for Community Contributions
- 058 - `todos/058-pending-p1-oauth21-compliance.md` - Replace Custom Bearer Tokens with OAuth 2.1 Compliance
- 062 - `todos/062-pending-p3-middleware-transform-system.md` - Add Middleware/Transform System for Request Pipeline

## Deferred Tech Debt (36)

- 076 - `todos/076-pending-p1-unbounded-cache-misses-tool-routing.md` - Unbounded Cache Misses in Tool Routing (Performance/DoS Risk)
- 078 - `todos/078-pending-p1-invisible-agent-features.md` - Invisible Agent Features (Projects, Skills, Workflows)
- 079 - `todos/079-pending-p1-broken-reactive-parity-list-changed.md` - Broken Reactive Parity (list_changed events not dispatched)
- 080 - `todos/080-pending-p2-loss-exception-type-safety.md` - Loss of Exception Type Safety (catch (error: any))
- 081 - `todos/081-pending-p2-blind-database-row-type-casting.md` - Blind Database Row Type Casting
- 082 - `todos/082-pending-p3-implicit-collection-types-bypassing-sdk.md` - Implicit Collection Types Bypassing MCP SDK
- 083 - `todos/083-pending-p2-inefficient-ipc-get-implementations.md` - Inefficient IPC get Implementations
- 084 - `todos/084-pending-p2-redundant-state-refetches-zustand.md` - Redundant State Refetches in Zustand Stores
- 085 - `todos/085-pending-p2-plaintext-mcp-server-secrets.md` - Plaintext Storage of MCP Server Secrets in SQLite
- 087 - `todos/087-pending-p2-blind-diagnostics-no-logs.md` - Blind Diagnostics (No Access to Logs)
- 088 - `todos/088-pending-p2-incomplete-workspace-parity.md` - Incomplete Workspace Parity
- 089 - `todos/089-pending-p2-lack-agent-self-awareness-prompts.md` - Lack of Agent Self-Awareness Context (Prompts API)
- 090 - `todos/090-pending-p3-contextbridge-type-degradation.md` - ContextBridge Type Degradation
- 091 - `todos/091-pending-p3-vitest-mock-type-assertions.md` - Vitest Mock Type Assertions Anti-Pattern
- 092 - `todos/092-pending-p3-non-null-assertions-missing-initializers.md` - Non-null Assertions (!.) Missing Guaranteed Initializers
- 093 - `todos/093-pending-p3-over-engineered-singletonservice.md` - Over-engineered SingletonService Base Class
- 094 - `todos/094-pending-p3-redundant-repository-wrappers.md` - Redundant Repository Wrappers (YAGNI)
- 095 - `todos/095-pending-p3-state-duplication-mcpservermanager.md` - State Duplication in MCPServerManager
- 097 - `todos/097-pending-p3-lack-strict-runtime-schema-validation-ipc.md` - Lack of Strict Runtime Schema Validation on IPC Input
- 104 - `todos/104-pending-p1-sync-sqlite-writes-block-event-loop.md` - Synchronous SQLite Writes Block Event Loop on Every Request
- 105 - `todos/105-pending-p1-getmaps-exposes-mutable-internal-state.md` - getMaps() Exposes Mutable Internal State of MCPServerManager
- 106 - `todos/106-pending-p1-zero-test-coverage-request-pipeline.md` - Zero Test Coverage for Critical Request Pipeline
- 114 - `todos/114-pending-p2-request-handlers-god-class.md` - RequestHandlers is a 1,097-Line God Class
- 116 - `todos/116-pending-p2-agent-native-parity-gap.md` - Agent-Native Feature Parity Gap -- Only 18 of ~50 UI Capabilities Exposed
- 117 - `todos/117-pending-p2-tool-catalog-requeries-all-servers.md` - Tool Catalog Re-queries All Servers on Every Search Request
- 118 - `todos/118-pending-p2-json-stringify-token-estimator.md` - Token Estimator Uses JSON.stringify on Every Request and Response
- 119 - `todos/119-pending-p2-three-ipc-error-handling-strategies.md` - Three Conflicting IPC Error Handling Strategies
- 121 - `todos/121-pending-p2-dxt-mcpb-converter-duplication.md` - DXT and MCPB Converters Have ~150 Lines of Duplicated Logic
- 122 - `todos/122-pending-p3-singleton-pattern-inconsistency.md` - Singleton Pattern Inconsistency Across Codebase
- 123 - `todos/123-pending-p3-health-metrics-over-engineered.md` - Health Metrics Tracker Over-Engineered for Desktop App
- 124 - `todos/124-pending-p3-token-budget-tracker-limited-value.md` - Token Budget Tracker Provides Limited Value with Rough Heuristics
- 125 - `todos/125-pending-p3-server-discovery-dead-code.md` - Server Discovery Contains ~200 Lines of Dead TOML Parsing Code
- 126 - `todos/126-pending-p3-task-registry-unused-methods.md` - Task Registry Contains Unused Methods
- 127 - `todos/127-pending-p3-event-bridge-reimplements-eventemitter.md` - EventBridge Reimplements EventEmitter; Three Parallel Event Systems Exist
- 128 - `todos/128-pending-p3-console-log-vs-structured-logger.md` - Console.log Dominates Over Structured Logger (307 vs 19 Calls)
- 129 - `todos/129-pending-p3-ipc-naming-inconsistency.md` - IPC Channel Naming Inconsistency (camelCase vs kebab-case)

## Next Step

Use the handoff prompt below with another agent to execute these items as real implementation work.
