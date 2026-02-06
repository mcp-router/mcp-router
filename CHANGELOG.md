# Changelog

All notable changes to MCP Router are documented in this file.

## Unreleased

### Added
- Unified Skills system with per-client control and symlink-based configuration
- Client App detection and management module
- MCP Marketplace with GitHub stats and skill discovery
- Activity log filter bar
- Security utilities: path validation, SVG sanitization, error boundary
- Cloud sync module enhancements

### Changed
- Comprehensive GUI redesign with friendly rounded minimal design
- Enhanced hook module editor and workflow manager
- Server details page with dev mode and enhanced settings

### Fixed
- Resolved 12 code review findings from multi-agent analysis
- Retry logic for initial MCP server connection attempts

## v0.10.0

### Added
- Semantic tool addressing in tool catalog
- Catalog mode enabled by default for all clients

## v0.9.0

### Added
- MiniSearch provider with fuzzy matching for tool discovery
- `tool_capabilities` meta-tool for querying tool metadata
- `detailLevel` parameter for discovery responses
- CLI synonym dictionary for search query expansion
- Actionable error messages with recovery hints

### Fixed
- Shell environment caching during server manager initialization
- PATH augmented with common Node.js binary locations
- Tool count accuracy and parallelized server queries

## v0.8.0

### Added
- Connection health monitoring with exponential backoff
- `ReconnectingMCPClient` wrapper with auto-reconnect and health checks
- Periodic health check utility for HTTP connections
- Client reconnection triggers tool mapping refresh

### Fixed
- Race condition guard in reconnect attempts
- Duplicate status update on initial server connect

## v0.7.0

### Added
- REST API router with health and server endpoints
- SSE Event Bridge for real-time event streaming
- MCP Marketplace REST endpoints
- Hot Reload via `DevWatcherService` with file-watch based server restart
- Structured logging with Pino and XDG-compliant file output
- 30-day log retention cleanup
- MCP Spec 2025-11-25 Phase 1: tool annotations, outputSchema, elicitation passthrough, resource link transformation
- URL validation utility for SSRF prevention
- Token expiration support
- RFC 8707 resource indicator types
- Tool catalog with BM25F search and project optimization
- Skills management feature with agent path management
- Server name prefixing for tool names
- Project selection when adding servers

### Changed
- Documentation translated from Japanese to English
- Extracted shared tool-naming utility

### Fixed
- Token default 24hr expiration removed (was too aggressive)
