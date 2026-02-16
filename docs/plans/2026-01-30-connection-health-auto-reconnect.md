# ADR: Connection Health Detection & Auto-Reconnect

> **Status: Completed** (Tasks 1-6 implemented; Task 7 manual testing pending)

## Context

MCP Router had no mechanism to detect or recover from lost connections:

- SSE streams could silently close (laptop sleep, server timeout)
- HTTP server sessions could expire without notification
- `MCPServer.status` was not updated when connections failed
- Users had to manually toggle servers off/on to recover

This created a poor experience for always-on desktop usage where connections inevitably drop.

## Decision

Implement a three-layer auto-reconnect architecture:

1. **ConnectionMonitor** -- Tracks connection state machine, manages exponential backoff reconnection
2. **HealthChecker** -- Periodic HTTP pings to detect stale sessions before they fail
3. **ReconnectingMCPClient** -- Wraps the MCP SDK `Client` with transport callbacks that trigger the monitor

### Architecture

```
Transport close/error detected
    |
    v
ConnectionMonitor.handleConnectionLost()
    |
    v
Status -> "reconnecting" (UI shows "Starting...")
    |
    v
Wait (exponential backoff: 1s -> 2s -> 4s -> 8s -> 16s -> 30s max)
    |
    v
Attempt reconnect (create new transport + client)
    |
    +-- Success -> Status -> "connected" (UI shows "Running")
    +-- Failure -> Retry (up to max) or Status -> "failed" (UI shows "Error")
```

For HTTP transports, a `HealthChecker` runs periodic pings (default 30s interval, 3-failure threshold) to detect stale sessions proactively, before the next tool call fails.

### Connection State Machine

```
disconnected -> connecting -> connected -> reconnecting -> connected (success)
                                       \-> reconnecting -> failed (max retries)
```

States map to existing `MCPServer.status` values:
- `connected` -> `"running"`
- `connecting` / `reconnecting` -> `"starting"` (with `errorMessage: "Reconnecting..."`)
- `failed` -> `"error"`
- `disconnected` -> `"stopped"`

## Key Implementation Files

### Core Classes

| File | Purpose |
|------|---------|
| `apps/electron/src/main/modules/mcp-server-manager/connection-monitor.ts` | State machine with exponential backoff (1s-30s, configurable max retries) |
| `apps/electron/src/main/modules/mcp-server-manager/health-checker.ts` | Periodic HTTP health ping with configurable failure threshold |
| `apps/electron/src/main/modules/mcp-server-manager/reconnecting-mcp-client.ts` | Wraps MCP SDK Client; hooks transport `onclose`/`onerror` to trigger monitor |

### Integration Points

| File | Change |
|------|--------|
| `apps/electron/src/main/modules/mcp-server-manager/mcp-server-manager.ts` | Uses `ReconnectingMCPClient` instead of raw `Client`; maps connection states to server status; emits UI events |
| `apps/cli/src/mcp-aggregator.ts` | `handleClientReconnected()` refreshes tool-to-server mappings after reconnect |

### Tests

| File | Coverage |
|------|----------|
| `.../__tests__/connection-monitor.test.ts` | State transitions, exponential backoff, max retry cap, dispose cleanup |
| `.../__tests__/health-checker.test.ts` | Interval pinging, failure threshold, success reset, start/stop lifecycle |
| `.../__tests__/reconnecting-mcp-client.test.ts` | Transport callback wiring, reconnect trigger, dispose cleanup |

## Configuration Defaults

| Parameter | Default | Description |
|-----------|---------|-------------|
| `maxRetries` | 5 | Maximum reconnection attempts before marking failed |
| `initialDelayMs` | 1000 | First backoff delay |
| `maxDelayMs` | 30000 | Maximum backoff delay cap |
| `healthCheckIntervalMs` | 30000 | HTTP health ping interval |
| `failureThreshold` | 3 | Consecutive health check failures before triggering reconnect |

## Consequences

- **Positive**: Connections recover automatically from transient failures (sleep/wake, network blips, server restarts)
- **Positive**: No new UI states needed -- reuses existing `starting`/`error` status values
- **Positive**: Health checker catches HTTP session expiry before users notice
- **Negative**: Adds complexity to connection lifecycle; reconnection may briefly interrupt in-flight tool calls
- **Negative**: Stdio (local) transports get reconnect wiring but rarely benefit (process exit is usually permanent)

## Pending Work

- **Manual integration testing** (Task 7): Test SSE reconnection on sleep/wake, HTTP reconnection on server restart, max retry failure behavior. See original plan for detailed test checklist.
