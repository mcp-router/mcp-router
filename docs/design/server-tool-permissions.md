# MCP Server Tool Enable/Disable Design

## Overview
- Allow users to enable or disable individual MCP server tools from the server detail sheet in the Electron UI.
- Persist the server-level `toolPermissions` map so disabled tools remain inactive after restart.
- Filter disabled tools from aggregated listings and prevent invocation at runtime.

## Current State
- `ServerDetailsAdvancedSheet` presents general settings and input parameters but has no tooling controls.
- `useServerEditingStore` tracks command, args, env, etc. but lacks tool permission state.
- Main process exposes `updateServerToolPermissions`, yet the IPC layer never calls it and database rows lack a `tool_permissions` column.
- Runtime tooling (`request-handlers.ts`) lists and invokes tools without inspecting `toolPermissions`, so global disablement is impossible.

## Proposed Changes
### Renderer UI
- Add a “Tools” tab to `ServerDetailsAdvancedSheet` that appears when tools are available.
- Fetch tools on demand through `platformAPI.servers.listTools(server.id)` and show each entry with a `Switch`.
- Extend `useServerEditingStore` with `editedToolPermissions` plus helpers, initializing from the server entity.
- Mark tool edits dirty and pass a new `updatedToolPermissions` payload to `handleSave`. The `Home.tsx` caller forwards this map to `updateServerConfig`.

### Platform API & IPC
- Extend `ServerAPI` with:
  - `listTools(id: string): Promise<MCPTool[]>`
  - `updateToolPermissions(id: string, map: Record<string, boolean>): Promise<MCPServer>`
- Implement the methods in `electron-platform-api.ts`, wiring them to new preload bridge functions:
  - `listMcpServerTools`
  - `updateToolPermissions`
- Register the handlers in `mcp-server-manager.ipc.ts` and delegate to `MCPServerManager` (`listTools` may require starting the server first or returning an error if stopped).
- Mirror the API in `remote-platform-api.ts` so remote workspaces call tRPC endpoints (remote backend changes required).

### Persistence
- Add a `tool_permissions TEXT` column to the `servers` table via a database migration.
- Update `McpServerManagerRepository` mapping helpers to serialize/deserialize the JSON map.
- Ensure `ServerService` and `MCPServerManager.getServers()` surface `toolPermissions` to the renderer, and `updateServerToolPermissions` persists via `serverService.updateServer`.

### Runtime Filtering
- Update `RequestHandlers.getAllToolsInternal` to skip tools whose `toolPermissions[name] === false`.
- In `handleCallTool`, reject requests for disabled tools with `InvalidRequest`.
- Optional: include `enabled` flags in responses to clients consuming aggregated tool lists.

## Behavioural Notes
- When the server is stopped, the Tools tab can either request a start/retry or display guidance stating that tools require the server to be running.
- Tool fetching should handle failures gracefully (toast + retry option).

## Testing & Validation
- UI smoke test: toggle tool states, save, reopen sheet, and confirm persistence.
- Database migration test: existing installs migrate with `tool_permissions` defaulting to `{}`.
- Runtime test: call disabled tools through the aggregated router and confirm they are blocked.
- Remote workspace test: verify the new API routes function over tRPC once implemented server-side.
